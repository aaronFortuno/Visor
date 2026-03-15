import type { WSContext } from "hono/ws";
import { bus } from "../core/emitter.ts";
import { sendInput, resizeSession, listSessions } from "../core/session-manager.ts";
import type { WsServerMessage } from "../core/types.ts";

interface ClientState {
  subscriptions: Map<string, () => void>;
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
      const { sessionId } = msg;
      if (state.subscriptions.has(sessionId)) break;
      const unsub = bus.on("session:output", ({ sessionId: sid, kind, data }) => {
        if (sid === sessionId && (kind === "stdout" || kind === "stderr")) {
          send(ws, { type: "output", sessionId: sid, kind, data, timestamp: new Date().toISOString() });
        }
      });
      state.subscriptions.set(sessionId, unsub);
      break;
    }
    case "unsubscribe": {
      const unsub = state.subscriptions.get(msg.sessionId);
      if (unsub) { unsub(); state.subscriptions.delete(msg.sessionId); }
      break;
    }
    case "input": {
      try { sendInput(msg.sessionId, msg.data); }
      catch (err: any) { send(ws, { type: "error", message: err.message }); }
      break;
    }
    case "resize": {
      try { resizeSession(msg.sessionId, msg.cols, msg.rows); } catch { /* ignore */ }
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
    for (const unsub of state.subscriptions.values()) unsub();
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
