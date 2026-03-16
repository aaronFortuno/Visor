// ── Session types ──────────────────────────────────────────

export type SessionType = "claude-code" | "opencode" | "ollama" | "custom";
export type SessionStatus = "running" | "paused" | "stopped" | "error" | "suspended";

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

export interface CreateSessionOpts {
  name: string;
  type: SessionType;
  command: string;
  args?: string[];
  cwd?: string;
}

// ── Event types ────────────────────────────────────────────

export type EventKind = "stdout" | "stderr" | "stdin" | "system" | "question" | "chat";

export interface SessionEvent {
  id: number;
  sessionId: string;
  kind: EventKind;
  data: string;
  timestamp: string;
}

// ── WebSocket messages ─────────────────────────────────────

export type SubscribeMode = "raw" | "chat";

export type WsClientMessage =
  | { type: "subscribe"; sessionId: string; mode?: SubscribeMode }
  | { type: "unsubscribe"; sessionId: string }
  | { type: "input"; sessionId: string; data: string }
  | { type: "resize"; sessionId: string; cols: number; rows: number }
  | { type: "ping" };

export type WsServerMessage =
  | { type: "output"; sessionId: string; kind: EventKind; data: string; timestamp: string }
  | { type: "session:update"; session: Session }
  | { type: "session:list"; sessions: Session[] }
  | { type: "question"; sessionId: string; data: string; timestamp: string }
  | { type: "error"; message: string }
  | { type: "pong" };
