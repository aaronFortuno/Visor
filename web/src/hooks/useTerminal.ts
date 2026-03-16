import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface UseTerminalOpts {
  sessionId: string;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onOutput: (handler: (sid: string, kind: string, data: string) => void) => () => void;
  enabled: boolean;
}

const THEME = {
  background: "#0a0a0f", foreground: "#e4e4ef", cursor: "#6366f1",
  selectionBackground: "#6366f140",
  black: "#0a0a0f", red: "#ef4444", green: "#22c55e", yellow: "#eab308",
  blue: "#3b82f6", magenta: "#a855f7", cyan: "#06b6d4", white: "#e4e4ef",
  brightBlack: "#4b5563", brightRed: "#f87171", brightGreen: "#4ade80",
  brightYellow: "#facc15", brightBlue: "#60a5fa", brightMagenta: "#c084fc",
  brightCyan: "#22d3ee", brightWhite: "#f9fafb",
};

export function useTerminal({ sessionId, onInput, onResize, onOutput, enabled }: UseTerminalOpts) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const termInitialized = useRef(false);

  // ── Terminal setup ────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    // If already initialized for this session, just re-fit
    if (termRef.current && termInitialized.current) {
      const fit = fitRef.current;
      if (fit) {
        requestAnimationFrame(() => {
          fit.fit();
          onResize(termRef.current!.cols, termRef.current!.rows);
        });
      }
      return;
    }

    const term = new XTerm({
      theme: THEME,
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
      onResize(term.cols, term.rows);
    });

    term.onData((data) => onInput(data));

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fit.fit();
        onResize(term.cols, term.rows);
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
  }, [enabled, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Output routing: terminal always receives raw output ──
  useEffect(() => {
    if (!enabled) return;
    const unsub = onOutput((sid, kind, data) => {
      if (sid === sessionId && (kind === "stdout" || kind === "stderr")) {
        termRef.current?.write(data);
      }
    });
    return unsub;
  }, [sessionId, onOutput, enabled]);

  // ── Cleanup terminal on unmount ─────────────────────────
  useEffect(() => {
    return () => {
      termRef.current?.dispose();
      termRef.current = null;
      termInitialized.current = false;
    };
  }, [sessionId]);

  return { containerRef, termRef };
}
