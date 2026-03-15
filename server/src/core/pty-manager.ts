import * as pty from "node-pty";
import { bus } from "./emitter.ts";
import { insertEvent, updateSession } from "../db/database.ts";
import type { Session } from "./types.ts";

interface PtyHandle {
  process: pty.IPty;
  sessionId: string;
}

const activePtys = new Map<string, PtyHandle>();

function resolveCommand(command: string): string {
  if (process.platform !== "win32") return command;
  if (/\.(cmd|exe|bat|ps1)$/i.test(command)) return command;
  if (/[/\\]/.test(command)) return command;
  return `${command}.cmd`;
}

export function spawnPty(session: Session): pty.IPty {
  const shell = resolveCommand(session.command);

  const ptyProcess = pty.spawn(shell, session.args, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: session.cwd,
    env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
  });

  activePtys.set(session.id, { process: ptyProcess, sessionId: session.id });

  // Question detection buffer
  let questionBuffer = "";

  ptyProcess.onData((data: string) => {
    insertEvent(session.id, "stdout", data);
    bus.emit("session:output", { sessionId: session.id, kind: "stdout", data });

    // Detect questions in output
    questionBuffer = (questionBuffer + data).slice(-500);
    const QUESTION_PATTERNS = [
      /\?\s*$/, /\(y\/n\)/i, /\(yes\/no\)/i, /\[Y\/n\]/, /\[y\/N\]/,
      /proceed\?/i, /continue\?/i, /Do you want/i, /confirm/i,
    ];
    for (const pattern of QUESTION_PATTERNS) {
      if (pattern.test(questionBuffer.slice(-200))) {
        bus.emit("session:output", {
          sessionId: session.id,
          kind: "question" as any,
          data: questionBuffer.slice(-200).trim(),
        });
        questionBuffer = "";
        break;
      }
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    activePtys.delete(session.id);
    const updated = updateSession(session.id, {
      status: exitCode === 0 ? "stopped" : "error",
      pid: null,
    });
    if (updated) bus.emit("session:update", { session: updated });
    bus.emit("session:exit", { sessionId: session.id, code: exitCode });
  });

  return ptyProcess;
}

export function writeToPty(sessionId: string, data: string): boolean {
  const h = activePtys.get(sessionId);
  if (!h) return false;
  h.process.write(data);
  insertEvent(sessionId, "stdin", data);
  return true;
}

export function resizePty(sessionId: string, cols: number, rows: number): boolean {
  const h = activePtys.get(sessionId);
  if (!h) return false;
  h.process.resize(cols, rows);
  return true;
}

export function killPty(sessionId: string): boolean {
  const h = activePtys.get(sessionId);
  if (!h) return false;
  h.process.kill();
  activePtys.delete(sessionId);
  return true;
}

export function isPtyActive(sessionId: string): boolean {
  return activePtys.has(sessionId);
}

export function getPtyPid(sessionId: string): number | undefined {
  return activePtys.get(sessionId)?.process.pid;
}
