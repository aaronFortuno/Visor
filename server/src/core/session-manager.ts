import { nanoid } from "nanoid";
import { homedir } from "node:os";
import { bus } from "./emitter.ts";
import { spawnPty, writeToPty, resizePty, killPty, isPtyActive, getPtyPid } from "./pty-manager.ts";
import {
  insertSession, getSessionById, getAllSessions, updateSession, deleteSession,
} from "../db/database.ts";
import type { Session, CreateSessionOpts } from "./types.ts";

const AGENT_TEMPLATES: Record<string, Omit<CreateSessionOpts, "name">> = {
  "claude-code": { type: "claude-code", command: "claude", args: [] },
  opencode: { type: "opencode", command: "opencode", args: [] },
};

// ── CRUD ───────────────────────────────────────────────────

export function createSession(opts: CreateSessionOpts): Session {
  const id = nanoid(12);
  const template = AGENT_TEMPLATES[opts.type];
  const merged: CreateSessionOpts = {
    ...template, ...opts,
    args: opts.args ?? template?.args ?? [],
    cwd: opts.cwd ?? homedir(),
  };
  return insertSession(id, merged);
}

export function startSession(id: string): Session {
  const session = getSessionById(id);
  if (!session) throw new Error(`Session ${id} not found`);
  if (isPtyActive(id)) throw new Error(`Session ${id} is already running`);
  const p = spawnPty(session);
  const updated = updateSession(id, { status: "running", pid: p.pid })!;
  bus.emit("session:update", { session: updated });
  return updated;
}

export function createAndStartSession(opts: CreateSessionOpts): Session {
  const session = createSession(opts);
  return startSession(session.id);
}

export function stopSession(id: string): Session {
  const session = getSessionById(id);
  if (!session) throw new Error(`Session ${id} not found`);
  killPty(id);
  const updated = updateSession(id, { status: "stopped", pid: null })!;
  bus.emit("session:update", { session: updated });
  return updated;
}

export function removeSession(id: string): void {
  if (isPtyActive(id)) killPty(id);
  if (!deleteSession(id)) throw new Error(`Session ${id} not found`);
}

export function sendInput(id: string, data: string): void {
  if (!writeToPty(id, data)) throw new Error(`Session ${id} is not running`);
}

export function resizeSession(id: string, cols: number, rows: number): void {
  resizePty(id, cols, rows);
}

export function getSession(id: string): Session | null {
  const session = getSessionById(id);
  if (!session) return null;
  if (session.status === "running" && !isPtyActive(id))
    return updateSession(id, { status: "error", pid: null });
  return session;
}

export function listSessions(): Session[] {
  for (const s of getAllSessions()) {
    if (s.status === "running" && !isPtyActive(s.id))
      updateSession(s.id, { status: "error", pid: null });
  }
  return getAllSessions();
}

export function restartSession(id: string): Session {
  const session = getSessionById(id);
  if (!session) throw new Error(`Session ${id} not found`);
  if (isPtyActive(id)) killPty(id);
  return startSession(id);
}

// ── Lifecycle: shutdown & startup ──────────────────────────

/**
 * Graceful shutdown: suspend all running sessions.
 * Marks them as "suspended" in DB so they can be restarted on next boot.
 */
export function suspendAllSessions(): void {
  const sessions = getAllSessions();
  let count = 0;

  for (const session of sessions) {
    if (isPtyActive(session.id)) {
      killPty(session.id);
      updateSession(session.id, { status: "suspended", pid: null });
      count++;
    } else if (session.status === "running") {
      // PTY already dead but status not updated
      updateSession(session.id, { status: "suspended", pid: null });
      count++;
    }
  }

  if (count > 0) {
    console.log(`  [visor] Suspended ${count} session(s)`);
  }
}

/**
 * Auto-restart: relaunch sessions that were suspended on previous shutdown.
 * Returns the number of sessions restarted.
 */
export function restoreSuspendedSessions(): number {
  const sessions = getAllSessions();
  let restored = 0;

  for (const session of sessions) {
    // Restore both "suspended" (clean shutdown) and "running" (crash/kill)
    if (session.status === "suspended" || session.status === "running") {
      try {
        console.log(`  [visor] Restoring session "${session.name}" (${session.type})...`);
        const p = spawnPty(session);
        updateSession(session.id, { status: "running", pid: p.pid });
        restored++;
      } catch (err: any) {
        console.error(`  [visor] Failed to restore "${session.name}": ${err.message}`);
        updateSession(session.id, { status: "error", pid: null });
      }
    }
  }

  return restored;
}

/**
 * Watchdog: check all sessions and sync status with PTY reality.
 * Call periodically (e.g. every 30s).
 */
export function watchdogCheck(): void {
  for (const session of getAllSessions()) {
    if (session.status === "running" && !isPtyActive(session.id)) {
      console.log(`  [visor] Watchdog: session "${session.name}" PTY died, marking as error`);
      const updated = updateSession(session.id, { status: "error", pid: null });
      if (updated) bus.emit("session:update", { session: updated });
    }
  }
}
