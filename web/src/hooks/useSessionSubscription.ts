import { useEffect } from "react";
import type { Terminal as XTerm } from "@xterm/xterm";
import { fetchEvents } from "../lib/api";

type ViewMode = "terminal" | "chat";

interface UseSessionSubscriptionOpts {
  sessionId: string;
  viewMode: ViewMode;
  isOllama: boolean;
  wsSubscribe: (sessionId: string, mode?: "raw" | "chat") => void;
  wsUnsubscribe: (sessionId: string) => void;
  termRef: React.RefObject<XTerm | null>;
}

export function useSessionSubscription({
  sessionId,
  viewMode,
  isOllama,
  wsSubscribe,
  wsUnsubscribe,
  termRef,
}: UseSessionSubscriptionOpts) {
  useEffect(() => {
    if (isOllama) return; // No WebSocket needed for Ollama sessions

    // Subscribe with the appropriate mode: raw for terminal keeps the
    // xterm buffer in sync; chat gives the ChatView pre-cleaned text.
    // Raw mode output is also used by ChatView's client-side fallback,
    // so raw works for both — but "chat" mode gives cleaner results.
    wsSubscribe(sessionId, viewMode === "chat" ? "chat" : "raw");

    // Replay recent output for terminal mode
    if (viewMode === "terminal") {
      fetchEvents(sessionId, { limit: 500 }).then(({ events }) => {
        for (const event of events) {
          if (event.kind === "stdout" || event.kind === "stderr") {
            termRef.current?.write(event.data);
          }
        }
      }).catch(() => {}); // silently fail if events unavailable
    }

    return () => {
      wsUnsubscribe(sessionId);
    };
  }, [sessionId, viewMode, isOllama]); // eslint-disable-line react-hooks/exhaustive-deps
}
