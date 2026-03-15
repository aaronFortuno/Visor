export type SessionType = "claude-code" | "opencode" | "ollama" | "custom";
export type SessionStatus = "running" | "paused" | "stopped" | "error" | "suspended";
export type EventKind = "stdout" | "stderr" | "stdin" | "system" | "question" | "chat";

export interface Session {
  id: string;
  name: string;
  type: SessionType;
  status: SessionStatus;
  command: string;
  args: string[];
  cwd: string;
  pid: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionEvent {
  id: number;
  sessionId: string;
  kind: EventKind;
  data: string;
  timestamp: string;
}

export type WsServerMessage =
  | { type: "output"; sessionId: string; kind: EventKind; data: string; timestamp: string }
  | { type: "session:update"; session: Session }
  | { type: "session:list"; sessions: Session[] }
  | { type: "question"; sessionId: string; data: string; timestamp: string }
  | { type: "error"; message: string }
  | { type: "pong" };
