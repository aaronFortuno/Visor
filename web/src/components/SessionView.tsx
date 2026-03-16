import { useState, useEffect, useCallback } from "react";
import type { Session } from "../lib/types";
import { controlSession, deleteSession as apiDeleteSession, renameSession } from "../lib/api";
import { useTerminal } from "../hooks/useTerminal";
import { useSessionSubscription } from "../hooks/useSessionSubscription";
import { SessionHeader } from "./SessionHeader";
import { ConfirmDialog } from "./ConfirmDialog";
import { ScrollControls } from "./ScrollControls";
import { ChatView } from "./ChatView";
import { MobileToolbar } from "./MobileToolbar";
import { OllamaChatView } from "./OllamaChatView";

type ViewMode = "terminal" | "chat";

interface Props {
  session: Session;
  onBack: () => void;
  wsSubscribe: (sessionId: string, mode?: "raw" | "chat") => void;
  wsUnsubscribe: (sessionId: string) => void;
  wsSendInput: (sessionId: string, data: string) => void;
  wsResize: (sessionId: string, cols: number, rows: number) => void;
  onOutput: (handler: (sid: string, kind: string, data: string) => void) => () => void;
}

export function SessionView({
  session, onBack, wsSubscribe, wsUnsubscribe, wsSendInput, wsResize, onOutput,
}: Props) {
  const isOllama = session.type === "ollama";
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "chat";
    return "terminal";
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [controlLoading, setControlLoading] = useState(false);
  const [controlError, setControlError] = useState("");

  const { containerRef, termRef } = useTerminal({
    sessionId: session.id,
    onInput: (data) => wsSendInput(session.id, data),
    onResize: (cols, rows) => wsResize(session.id, cols, rows),
    onOutput,
    enabled: !isOllama && viewMode === "terminal",
  });

  useSessionSubscription({
    sessionId: session.id,
    viewMode,
    isOllama,
    wsSubscribe,
    wsUnsubscribe,
    termRef,
  });

  // Auto-dismiss error toast after 3 seconds
  useEffect(() => {
    if (!controlError) return;
    const timer = setTimeout(() => setControlError(""), 3000);
    return () => clearTimeout(timer);
  }, [controlError]);

  const handleControl = async (action: "start" | "stop" | "restart") => {
    setControlLoading(true);
    setControlError("");
    try { await controlSession(session.id, action); }
    catch (e: any) { setControlError(e.message || "Control action failed"); }
    finally { setControlLoading(false); }
  };

  const handleDelete = async () => {
    setControlLoading(true);
    setControlError("");
    try { await apiDeleteSession(session.id); onBack(); }
    catch (e: any) { setControlError(e.message || "Delete failed"); setControlLoading(false); }
  };

  const handleRename = async (name: string) => {
    try {
      await renameSession(session.id, name);
    } catch (e: any) {
      setControlError(e.message || "Rename failed");
    }
  };

  const handleSendInput = useCallback(
    (data: string) => wsSendInput(session.id, data),
    [session.id, wsSendInput]
  );

  const sendKey = (key: string) => wsSendInput(session.id, key);

  return (
    <div className="flex flex-col h-full relative">
      <SessionHeader
        session={session}
        viewMode={viewMode}
        isOllama={isOllama}
        controlLoading={controlLoading}
        controlError={controlError}
        onBack={onBack}
        onViewModeChange={setViewMode}
        onControl={handleControl}
        onDelete={() => setShowDeleteConfirm(true)}
        onRename={handleRename}
      />

      {isOllama ? (
        <OllamaChatView session={session} />
      ) : viewMode === "terminal" ? (
        <>
          <div ref={containerRef} className="flex-1 min-h-0" />
          <ScrollControls onSendKey={sendKey} />
          <MobileToolbar
            sessionType={session.type}
            onSend={handleSendInput}
            onBack={onBack}
          />
        </>
      ) : (
        <ChatView
          sessionId={session.id}
          sessionType={session.type}
          onSend={handleSendInput}
          onOutput={onOutput}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete session?"
        message={`This will permanently delete "${session.name}" and all its history.`}
        onConfirm={() => { setShowDeleteConfirm(false); handleDelete(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
