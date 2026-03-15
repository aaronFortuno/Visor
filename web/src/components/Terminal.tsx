import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface Props {
  sessionId: string;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onOutput: (handler: (sessionId: string, kind: string, data: string) => void) => () => void;
  onUnmount?: () => void;
}

export function TerminalView({ sessionId, onInput, onResize, onOutput, onUnmount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const isMobile = !window.matchMedia("(min-width: 768px)").matches;

    const term = new XTerm({
      theme: {
        background: "#0a0a0f",
        foreground: "#e4e4ef",
        cursor: "#6366f1",
        cursorAccent: "#0a0a0f",
        selectionBackground: "#6366f140",
        black: "#0a0a0f",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e4e4ef",
        brightBlack: "#4b5563",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#f9fafb",
      },
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
      fontSize: isMobile ? 11 : 15,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();

    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);

    // ── Enable native touch scrolling ──────────────────────
    // xterm.js renders a .xterm-viewport div with overflow.
    // On mobile, we need to ensure it supports native touch scroll.
    const viewport = containerRef.current.querySelector(".xterm-viewport") as HTMLElement | null;
    if (viewport) {
      viewport.style.overflowY = "auto";
      // @ts-ignore — webkit vendor prefix for momentum scrolling
      viewport.style.webkitOverflowScrolling = "touch";
      viewport.style.touchAction = "pan-y";
    }

    // The xterm-screen sits on top and can block touch events.
    // Let touch events pass through to the viewport for scrolling.
    const screen = containerRef.current.querySelector(".xterm-screen") as HTMLElement | null;
    if (screen) {
      screen.style.touchAction = "pan-y";
    }

    // Fit to container
    requestAnimationFrame(() => {
      fit.fit();
      onResize(term.cols, term.rows);
    });

    // Handle user input (keyboard on desktop, toolbar on mobile)
    term.onData((data) => {
      onInput(data);
    });

    termRef.current = term;
    fitRef.current = fit;

    // Resize observer — also sends resize to PTY
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fit.fit();
        onResize(term.cols, term.rows);
      });
    });
    observer.observe(containerRef.current);

    // Subscribe to output
    const unsubOutput = onOutput((sid, kind, data) => {
      if (sid === sessionId && (kind === "stdout" || kind === "stderr")) {
        term.write(data);
      }
    });

    return () => {
      observer.disconnect();
      unsubOutput();
      onUnmount?.();
      term.dispose();
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-hidden"
      style={{ minHeight: "120px" }}
    />
  );
}
