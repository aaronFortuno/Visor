import { useEffect, useRef, useCallback, useState } from "react";
import type { Session, WsServerMessage, EventKind } from "../lib/types";
import { getToken } from "../lib/api";

type OutputHandler = (sessionId: string, kind: EventKind, data: string) => void;

interface UseWebSocketReturn {
  connected: boolean;
  sessions: Session[];
  subscribe: (sessionId: string) => void;
  unsubscribe: (sessionId: string) => void;
  sendInput: (sessionId: string, data: string) => void;
  resize: (sessionId: string, cols: number, rows: number) => void;
  onOutput: (handler: OutputHandler) => () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const outputHandlers = useRef(new Set<OutputHandler>());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMessages = useRef<object[]>([]);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      for (const msg of pendingMessages.current) ws.send(JSON.stringify(msg));
      pendingMessages.current = [];
    };

    ws.onmessage = (event) => {
      const msg: WsServerMessage = JSON.parse(event.data);
      switch (msg.type) {
        case "session:list": setSessions(msg.sessions); break;
        case "session:update":
          setSessions((prev) => {
            const idx = prev.findIndex((s) => s.id === msg.session.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = msg.session; return next; }
            return [msg.session, ...prev];
          });
          break;
        case "output":
          outputHandlers.current.forEach((h) => h(msg.sessionId, msg.kind, msg.data));
          break;
        case "question":
          // Browser notification when agent asks a question
          if (typeof Notification !== "undefined" && Notification.permission === "granted" && !document.hasFocus()) {
            new Notification("Visor — Agent Question", {
              body: (msg as any).data?.slice(0, 120) || "An agent needs your input",
              tag: `visor-q-${(msg as any).sessionId}`,
              requireInteraction: true,
            });
          }
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => { if (reconnectTimer.current) clearTimeout(reconnectTimer.current); wsRef.current?.close(); };
  }, [connect]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg));
    else pendingMessages.current.push(msg);
  }, []);

  return {
    connected,
    sessions,
    subscribe: useCallback((id: string) => send({ type: "subscribe", sessionId: id }), [send]),
    unsubscribe: useCallback((id: string) => send({ type: "unsubscribe", sessionId: id }), [send]),
    sendInput: useCallback((id: string, data: string) => send({ type: "input", sessionId: id, data }), [send]),
    resize: useCallback((id: string, cols: number, rows: number) => send({ type: "resize", sessionId: id, cols, rows }), [send]),
    onOutput: useCallback((handler: OutputHandler) => {
      outputHandlers.current.add(handler);
      return () => { outputHandlers.current.delete(handler); };
    }, []),
  };
}
