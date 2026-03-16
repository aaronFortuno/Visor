import { useState, useRef } from "react";
import type { Session } from "../lib/types";
import { StatusBadge, TypeBadge } from "./StatusBadge";

type ViewMode = "terminal" | "chat";

interface SessionHeaderProps {
  session: Session;
  viewMode: ViewMode;
  isOllama: boolean;
  controlLoading: boolean;
  controlError: string;
  onBack: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onControl: (action: "start" | "stop" | "restart") => void;
  onDelete: () => void;
  onRename: (name: string) => Promise<void>;
}

export function SessionHeader({
  session,
  viewMode,
  isOllama,
  controlLoading,
  controlError,
  onBack,
  onViewModeChange,
  onControl,
  onDelete,
  onRename,
}: SessionHeaderProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const startRenaming = () => {
    setRenameName(session.name);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const confirmRename = async () => {
    const trimmed = renameName.trim();
    if (!trimmed || trimmed === session.name) {
      setIsRenaming(false);
      return;
    }
    await onRename(trimmed);
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setIsRenaming(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-visor-border bg-visor-card shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white p-2 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmRename();
                  if (e.key === "Escape") cancelRename();
                }}
                onBlur={confirmRename}
                className="font-semibold text-white text-sm bg-visor-bg border border-visor-accent rounded px-1.5 py-0.5 outline-none w-40"
                autoFocus
              />
            ) : (
              <h2
                className="font-semibold text-white text-sm truncate cursor-pointer hover:text-visor-accent transition-colors"
                onClick={startRenaming}
                title="Click to rename"
              >
                {session.name}
              </h2>
            )}
            {!isRenaming && (
              <button
                onClick={startRenaming}
                className="text-gray-500 hover:text-visor-accent transition-colors p-0.5 shrink-0"
                title="Rename session"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            <TypeBadge type={session.type} />
            <StatusBadge status={session.status} />
          </div>
          <p className="text-[10px] text-gray-500 font-mono truncate hidden sm:block">{session.cwd}</p>
        </div>

        {/* View mode toggle — hidden for Ollama (no PTY) */}
        {!isOllama && (
          <div className="flex items-center bg-visor-bg rounded-lg border border-visor-border p-0.5 shrink-0">
            <button
              onClick={() => onViewModeChange("terminal")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "terminal"
                  ? "bg-visor-accent text-white"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Terminal view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => onViewModeChange("chat")}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === "chat"
                  ? "bg-visor-accent text-white"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Chat view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
        )}

        {/* Session controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          {!isOllama && session.status === "running" && (
            <>
              <button onClick={() => onControl("restart")} disabled={controlLoading} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-visor-yellow disabled:opacity-40 disabled:pointer-events-none rounded-lg" title="Restart">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button onClick={() => onControl("stop")} disabled={controlLoading} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-visor-red disabled:opacity-40 disabled:pointer-events-none rounded-lg" title="Stop">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
              </button>
            </>
          )}
          {!isOllama && session.status !== "running" && (
            <button onClick={() => onControl("start")} disabled={controlLoading} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-visor-green disabled:opacity-40 disabled:pointer-events-none rounded-lg" title="Start">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          )}
          <button onClick={onDelete} disabled={controlLoading} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-visor-red disabled:opacity-40 disabled:pointer-events-none rounded-lg" title="Delete">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {/* Error toast */}
      {controlError && (
        <div className="px-3 py-2 bg-visor-red/20 border-b border-visor-red/30 text-visor-red text-xs font-medium animate-fade-in">
          {controlError}
        </div>
      )}
    </>
  );
}
