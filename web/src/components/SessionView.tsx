import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import type { Session } from "../lib/types";
import { controlSession, deleteSession as apiDeleteSession } from "../lib/api";
import { StatusBadge, TypeBadge } from "./StatusBadge";
import { ChatView } from "./ChatView";
import { MobileToolbar } from "./MobileToolbar";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Default to chat on mobile, terminal on desktop
    if (typeof window !== "undefined" && window.innerWidth < 768) return "chat";
    return "terminal";
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  // Track if terminal has been initialized (so we don't re-create on mode switch)
  const termInitialized = useRef(false);

  // ── Terminal setup ────────────────────────────────────────

  useEffect(() => {
    // Only init terminal when in terminal mode
    if (viewMode !== "terminal" || !containerRef.current) return;
    // If already initialized for this session, just re-fit
    if (termRef.current && termInitialized.current) {
      const fit = fitRef.current;
      if (fit) {
        requestAnimationFrame(() => {
          fit.fit();
          wsResize(session.id, termRef.current!.cols, termRef.current!.rows);
        });
      }
      return;
    }

    const term = new XTerm({
      theme: {
        background: "#0a0a0f", foreground: "#e4e4ef", cursor: "#6366f1",
        selectionBackground: "#6366f140",
        black: "#0a0a0f", red: "#ef4444", green: "#22c55e", yellow: "#eab308",
        blue: "#3b82f6", magenta: "#a855f7", cyan: "#06b6d4", white: "#e4e4ef",
        brightBlack: "#4b5563", brightRed: "#f87171", brightGreen: "#4ade80",
        brightYellow: "#facc15", brightBlue: "#60a5fa", brightMagenta: "#c084fc",
        brightCyan: "#22d3ee", brightWhite: "#f9fafb",
      },
      fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
      fontSize: window.innerWidth < 768 ? 11 : 13,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 10000,
      smoothScrollDuration: 100,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);

    requestAnimationFrame(() => {
      fit.fit();
      wsResize(session.id, term.cols, term.rows);
    });

    term.onData((data) => wsSendInput(session.id, data));

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fit.fit();
        wsResize(session.id, term.cols, term.rows);
      });
    });
    observer.observe(containerRef.current);

    // Mobile touch scroll
    const xtermScreen = containerRef.current.querySelector(".xterm-screen") as HTMLElement;
    const xtermViewport = containerRef.current.querySelector(".xterm-viewport") as HTMLElement;

    let touchStartY = 0;
    let isScrolling = false;

    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      isScrolling = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!xtermViewport) return;
      const dy = touchStartY - e.touches[0].clientY;
      if (Math.abs(dy) > 5) {
        isScrolling = true;
        xtermViewport.scrollTop += dy * 1.5;
        touchStartY = e.touches[0].clientY;
        e.preventDefault();
      }
    };

    const onTouchEnd = () => { void isScrolling; isScrolling = false; };

    if (xtermScreen) {
      xtermScreen.addEventListener("touchstart", onTouchStart, { passive: true });
      xtermScreen.addEventListener("touchmove", onTouchMove, { passive: false });
      xtermScreen.addEventListener("touchend", onTouchEnd, { passive: true });
    }

    termRef.current = term;
    fitRef.current = fit;
    termInitialized.current = true;

    return () => {
      observer.disconnect();
      if (xtermScreen) {
        xtermScreen.removeEventListener("touchstart", onTouchStart);
        xtermScreen.removeEventListener("touchmove", onTouchMove);
        xtermScreen.removeEventListener("touchend", onTouchEnd);
      }
    };
  }, [viewMode, session.id]); // eslint-disable-line

  // ── Output routing: terminal always receives raw output ──
  useEffect(() => {
    const unsub = onOutput((sid, kind, data) => {
      if (sid === session.id && (kind === "stdout" || kind === "stderr")) {
        termRef.current?.write(data);
      }
    });
    return unsub;
  }, [session.id, onOutput]);

  // ── Subscribe/unsubscribe — re-subscribe on mode change ─
  useEffect(() => {
    // Subscribe with the appropriate mode: raw for terminal keeps the
    // xterm buffer in sync; chat gives the ChatView pre-cleaned text.
    // Raw mode output is also used by ChatView's client-side fallback,
    // so raw works for both — but "chat" mode gives cleaner results.
    wsSubscribe(session.id, viewMode === "chat" ? "chat" : "raw");

    return () => {
      wsUnsubscribe(session.id);
    };
  }, [session.id, viewMode]); // eslint-disable-line

  // ── Cleanup terminal on unmount ─────────────────────────
  useEffect(() => {
    return () => {
      termRef.current?.dispose();
      termRef.current = null;
      termInitialized.current = false;
    };
  }, [session.id]);

  // ── Scroll controls for terminal mode ───────────────────

  const sendKey = (key: string) => wsSendInput(session.id, key);
  const scrollUp = () => sendKey("\x1b[5~");
  const scrollDown = () => sendKey("\x1b[6~");
  const scrollUpFast = () => { for (let i = 0; i < 5; i++) sendKey("\x1b[5~"); };
  const scrollDownFast = () => { for (let i = 0; i < 5; i++) sendKey("\x1b[6~"); };

  // ── Session controls ────────────────────────────────────

  const handleControl = async (action: "start" | "stop" | "restart") => {
    try { await controlSession(session.id, action); } catch (e: any) { console.error(e.message); }
  };

  const handleDelete = async () => {
    try { await apiDeleteSession(session.id); onBack(); }
    catch (e: any) { console.error(e.message); }
  };

  const handleSendInput = useCallback(
    (data: string) => wsSendInput(session.id, data),
    [session.id, wsSendInput]
  );

  return (
    <div className="flex flex-col h-full relative">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-visor-border bg-visor-card shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white p-2 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-white text-sm truncate">{session.name}</h2>
            <TypeBadge type={session.type} />
            <StatusBadge status={session.status} />
          </div>
          <p className="text-[10px] text-gray-500 font-mono truncate hidden sm:block">{session.cwd}</p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-visor-bg rounded-lg border border-visor-border p-0.5 shrink-0">
          <button
            onClick={() => setViewMode("terminal")}
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
            onClick={() => setViewMode("chat")}
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

        {/* Session controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          {session.status === "running" ? (
            <>
              <button onClick={() => handleControl("restart")} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-visor-yellow rounded-lg" title="Restart">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button onClick={() => handleControl("stop")} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-visor-red rounded-lg" title="Stop">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
              </button>
            </>
          ) : (
            <button onClick={() => handleControl("start")} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-visor-green rounded-lg" title="Start">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          )}
          <button onClick={() => setShowDeleteConfirm(true)} className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-visor-red rounded-lg" title="Delete">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {/* ── Content area ───────────────────────────────────── */}

      {viewMode === "terminal" ? (
        <>
          {/* Terminal */}
          <div ref={containerRef} className="flex-1 min-h-0" />

          {/* Scroll controls — floating on the right side (hidden on mobile when toolbar is visible) */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10 hidden md:flex">
            <button onClick={scrollUpFast} className="w-9 h-9 flex items-center justify-center rounded-full bg-visor-card/90 border border-visor-border text-gray-400 hover:text-white active:bg-visor-accent/30 backdrop-blur-sm shadow-md" title="Scroll up fast">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5" /></svg>
            </button>
            <button onClick={scrollUp} className="w-9 h-9 flex items-center justify-center rounded-full bg-visor-card/90 border border-visor-border text-gray-400 hover:text-white active:bg-visor-accent/30 backdrop-blur-sm shadow-md" title="Page Up">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
            </button>
            <button onClick={scrollDown} className="w-9 h-9 flex items-center justify-center rounded-full bg-visor-card/90 border border-visor-border text-gray-400 hover:text-white active:bg-visor-accent/30 backdrop-blur-sm shadow-md" title="Page Down">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            <button onClick={scrollDownFast} className="w-9 h-9 flex items-center justify-center rounded-full bg-visor-card/90 border border-visor-border text-gray-400 hover:text-white active:bg-visor-accent/30 backdrop-blur-sm shadow-md" title="Scroll down fast">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 5.25l-7.5 7.5-7.5-7.5m15 6l-7.5 7.5-7.5-7.5" /></svg>
            </button>
          </div>

          {/* Mobile toolbar — only visible on mobile in terminal mode */}
          <MobileToolbar
            sessionType={session.type}
            onSend={handleSendInput}
            onBack={onBack}
          />
        </>
      ) : (
        /* Chat view */
        <ChatView
          sessionId={session.id}
          sessionType={session.type}
          onSend={handleSendInput}
          onOutput={onOutput}
        />
      )}

      {/* ── Delete confirmation dialog ─────────────────────── */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-visor-card border border-visor-border rounded-xl p-5 mx-4 max-w-sm w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-2">Delete session?</h3>
            <p className="text-gray-400 text-sm mb-4">This will permanently delete "{session.name}" and all its history.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 border border-visor-border rounded-lg text-gray-400 hover:text-white transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); handleDelete(); }}
                className="flex-1 py-2.5 bg-visor-red/90 hover:bg-red-600 text-white rounded-lg font-medium transition-colors text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
