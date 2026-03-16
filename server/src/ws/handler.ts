import type { WSContext } from "hono/ws";
import { bus } from "../core/emitter.ts";
import { sendInput, resizeSession, listSessions } from "../core/session-manager.ts";
import { ScreenBuffer } from "../core/screen-buffer.ts";
import type { WsServerMessage, SubscribeMode } from "../core/types.ts";

interface Subscription {
  mode: SubscribeMode;
  unsubscribe: () => void;
  screenBuffer?: ScreenBuffer;
}

interface ClientState {
  subscriptions: Map<string, Subscription>;
}

const clients = new Map<WSContext, ClientState>();

function send(ws: WSContext, msg: WsServerMessage): void {
  try { ws.send(JSON.stringify(msg)); } catch { /* disconnected */ }
}

export function handleWsOpen(ws: WSContext): void {
  clients.set(ws, { subscriptions: new Map() });
  send(ws, { type: "session:list", sessions: listSessions() });
}

export function handleWsMessage(ws: WSContext, raw: string | ArrayBuffer): void {
  const state = clients.get(ws);
  if (!state) return;

  let msg: any;
  try {
    msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
  } catch { return; }

  switch (msg.type) {
    case "subscribe": {
      const { sessionId, mode = "raw" } = msg;
      if (state.subscriptions.has(sessionId)) break;

      if (mode === "chat") {
        // ── Chat mode: pipe output through ScreenBuffer ─────
        const screenBuffer = new ScreenBuffer(80, 24);

        const unsub = bus.on("session:output", ({ sessionId: sid, kind, data }) => {
          if (sid !== sessionId) return;
          if (kind !== "stdout" && kind !== "stderr") return;

          screenBuffer.write(data);
          const newContent = screenBuffer.extractNewContent();
          if (newContent) {
            send(ws, {
              type: "output",
              sessionId: sid,
              kind: "chat",
              data: newContent,
              timestamp: new Date().toISOString(),
            });
          }
        });

        state.subscriptions.set(sessionId, { mode: "chat", unsubscribe: unsub, screenBuffer });
      } else {
        // ── Raw mode: forward stdout/stderr directly ────────
        const unsub = bus.on("session:output", ({ sessionId: sid, kind, data }) => {
          if (sid === sessionId && (kind === "stdout" || kind === "stderr")) {
            send(ws, { type: "output", sessionId: sid, kind, data, timestamp: new Date().toISOString() });
          }
        });

        state.subscriptions.set(sessionId, { mode: "raw", unsubscribe: unsub });
      }
      break;
    }
    case "unsubscribe": {
      const sub = state.subscriptions.get(msg.sessionId);
      if (sub) {
        sub.unsubscribe();
        state.subscriptions.delete(msg.sessionId);
      }
      break;
    }
    case "input": {
      try { sendInput(msg.sessionId, msg.data); }
      catch (err: any) { send(ws, { type: "error", message: err.message }); }
      break;
    }
    case "resize": {
      try {
        resizeSession(msg.sessionId, msg.cols, msg.rows);
        // Also resize the screen buffer for chat subscribers
        const sub = state.subscriptions.get(msg.sessionId);
        if (sub?.screenBuffer) {
          sub.screenBuffer.resize(msg.cols, msg.rows);
        }
      } catch { /* ignore */ }
      break;
    }
    case "ping": {
      send(ws, { type: "pong" });
      break;
    }
  }
}

export function handleWsClose(ws: WSContext): void {
  const state = clients.get(ws);
  if (state) {
    for (const sub of state.subscriptions.values()) sub.unsubscribe();
    clients.delete(ws);
  }
}

bus.on("session:update", ({ session }) => {
  for (const [ws] of clients) send(ws, { type: "session:update", session });
});

// Broadcast question alerts to ALL connected clients (not just subscribed)
bus.on("session:output", ({ sessionId, kind, data }) => {
  if (kind === "question") {
    for (const [ws] of clients) {
      send(ws, { type: "question", sessionId, data, timestamp: new Date().toISOString() } as any);
    }
  }
});
