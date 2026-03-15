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
    return updateSession(id, { status: "stopped", pid: null });
  return session;
}

export function listSessions(): Session[] {
  for (const s of getAllSessions()) {
    if (s.status === "running" && !isPtyActive(s.id))
      updateSession(s.id, { status: "stopped", pid: null });
  }
  return getAllSessions();
}

export function restartSession(id: string): Session {
  const session = getSessionById(id);
  if (!session) throw new Error(`Session ${id} not found`);
  if (isPtyActive(id)) killPty(id);
  return startSession(id);
}
