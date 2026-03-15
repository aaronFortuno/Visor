import { useState, useRef, useEffect, useCallback } from "react";
import type { SessionType } from "../lib/types";
import { MarkdownMessage } from "./MarkdownMessage";

interface Props {
  sessionId: string;
  sessionType: SessionType;
  onSend: (data: string) => void;
  onOutput: (handler: (sid: string, kind: string, data: string) => void) => () => void;
  onBack: () => void;
}

// ── Slash commands per agent type ──────────────────────────

interface SlashCommand {
  command: string;
  description: string;
}

const SLASH_COMMANDS: Record<string, SlashCommand[]> = {
  "claude-code": [
    { command: "/help", description: "Show help" },
    { command: "/clear", description: "Clear conversation" },
    { command: "/compact", description: "Compact context" },
    { command: "/model", description: "Switch model" },
    { command: "/cost", description: "Token usage & cost" },
    { command: "/config", description: "View config" },
    { command: "/doctor", description: "Run diagnostics" },
  ],
  opencode: [
    { command: "/help", description: "Show help" },
    { command: "/clear", description: "Clear conversation" },
    { command: "/compact", description: "Compact context" },
    { command: "/model", description: "Switch model" },
    { command: "/cost", description: "Token usage & cost" },
    { command: "/diff", description: "Show pending diffs" },
    { command: "/undo", description: "Undo last change" },
  ],
  ollama: [],
  custom: [],
};

// ── Component ──────────────────────────────────────────────

export function ChatView({ sessionId, sessionType, onSend, onOutput, onBack }: Props) {
  const [lines, setLines] = useState<Array<{ text: string; kind: "output" | "input" | "system"; ts: number }>>([]);
  const [inputText, setInputText] = useState("");
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [inputHistory, setInputHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("visor-input-history") || "[]"); } catch { return []; }
  });
  const [historyIdx, setHistoryIdx] = useState(-1);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const slashCommands = SLASH_COMMANDS[sessionType] || [];
  const filteredSlash = slashFilter
    ? slashCommands.filter((c) => c.command.includes(slashFilter.toLowerCase()))
    : slashCommands;

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  // Subscribe to output — server sends clean "chat" blocks, already deduplicated.
  // Merge consecutive output blocks into a single message to avoid many small bubbles.
  useEffect(() => {
    const unsub = onOutput((sid, kind, data) => {
      if (sid !== sessionId) return;
      if (kind !== "chat") return;

      setLines((prev) => {
        const last = prev[prev.length - 1];
        // If the last message is also output and recent (<2s), append to it
        if (last && last.kind === "output" && Date.now() - last.ts < 2000) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text: last.text + "\n" + data,
            ts: Date.now(),
          };
          return updated;
        }
        // Otherwise create a new message
        return [...prev, { text: data, kind: "output" as const, ts: Date.now() }];
      });
      scrollToBottom();
    });

    return unsub;
  }, [sessionId, onOutput, scrollToBottom]);

  // ── Send input ───────────────────────────────────────────

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    // Add to chat as user message
    setLines((prev) => [...prev, { text, kind: "input", ts: Date.now() }]);

    // Send text to PTY, then Enter separately after a small delay.
    // Some TUI apps (opencode, claude) treat pasted text differently
    // from typed text — sending \r separately ensures it's processed as Enter.
    onSend(text);
    setTimeout(() => onSend("\r"), 50);

    // Save to history
    const newHistory = [text, ...inputHistory.filter((h) => h !== text)].slice(0, 50);
    setInputHistory(newHistory);
    localStorage.setItem("visor-input-history", JSON.stringify(newHistory));

    setInputText("");
    setHistoryIdx(-1);
    setShowSlash(false);
    scrollToBottom();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter to send — works on desktop.
    // For mobile keyboards that don't fire "Enter" key, we also
    // handle it via a wrapping <form> onSubmit.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Enter" && e.nativeEvent.isComposing) {
      // IME composing (some mobile keyboards), ignore
      return;
    }
    if (e.key === "ArrowUp" && !inputText) {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, inputHistory.length - 1);
      if (next >= 0) {
        setHistoryIdx(next);
        setInputText(inputHistory[next]);
      }
    }
    if (e.key === "ArrowDown" && historyIdx >= 0) {
      e.preventDefault();
      const next = historyIdx - 1;
      if (next < 0) {
        setHistoryIdx(-1);
        setInputText("");
      } else {
        setHistoryIdx(next);
        setInputText(inputHistory[next]);
      }
    }
    if (e.key === "/" && !inputText) {
      setShowSlash(true);
    }
    if (e.key === "Escape") {
      setShowSlash(false);
    }
  };

  const handleSlashSelect = (cmd: SlashCommand) => {
    onSend(cmd.command + "\r");
    setLines((prev) => [...prev, { text: cmd.command, kind: "input", ts: Date.now() }]);
    setShowSlash(false);
    setSlashFilter("");
    scrollToBottom();
  };

  // Detect "/" at start of input for slash menu
  useEffect(() => {
    if (inputText.startsWith("/")) {
      setShowSlash(true);
      setSlashFilter(inputText);
    } else if (showSlash && !inputText.startsWith("/")) {
      setShowSlash(false);
      setSlashFilter("");
    }
  }, [inputText, showSlash]);

  // ── Quick actions ────────────────────────────────────────

  const quickActions = [
    { label: "Ctrl+C", value: "\x03" },
    { label: "y", value: "y\r" },
    { label: "n", value: "n\r" },
    { label: "Enter", value: "\r" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* ── Message area ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {lines.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Waiting for output...
          </div>
        )}

        {lines.map((line, i) => (
          <div
            key={i}
            className={`animate-fade-in ${
              line.kind === "input" ? "flex justify-end" : ""
            }`}
          >
            {line.kind === "input" ? (
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-visor-accent/20 text-indigo-200 border border-visor-accent/30 font-mono whitespace-pre-wrap break-words">
                {line.text}
              </div>
            ) : (
              <div className="max-w-[95%] rounded-lg px-4 py-3 bg-visor-card border border-visor-border">
                <MarkdownMessage content={line.text} />
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── Slash command popup ────────────────────────────── */}
      {showSlash && filteredSlash.length > 0 && (
        <div className="border-t border-visor-border bg-visor-card max-h-48 overflow-y-auto animate-fade-in">
          {filteredSlash.map((cmd) => (
            <button
              key={cmd.command}
              onClick={() => handleSlashSelect(cmd)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-visor-bg active:bg-visor-accent/10 transition-colors text-left"
            >
              <span className="text-visor-accent font-mono text-sm font-medium min-w-[80px]">
                {cmd.command}
              </span>
              <span className="text-gray-500 text-xs truncate">
                {cmd.description}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Quick action bar ──────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-visor-border bg-visor-card overflow-x-auto">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onSend(action.value)}
            className="shrink-0 px-2.5 py-1 bg-visor-bg border border-visor-border rounded text-xs text-gray-400 hover:text-white active:bg-visor-accent/20 transition-colors font-mono"
          >
            {action.label}
          </button>
        ))}

        {slashCommands.length > 0 && (
          <button
            onClick={() => { setShowSlash(!showSlash); inputRef.current?.focus(); }}
            className={`shrink-0 w-7 h-7 flex items-center justify-center rounded text-sm font-bold transition-colors ${
              showSlash ? "bg-visor-accent text-white" : "bg-visor-bg border border-visor-border text-visor-accent"
            }`}
          >
            /
          </button>
        )}

        <div className="flex-1" />

        {/* Swipe hint on mobile */}
        <button
          onClick={onBack}
          className="shrink-0 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Back
        </button>
      </div>

      {/* ── Input bar ─────────────────────────────────────── */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="flex items-end gap-2 px-3 py-3 border-t border-visor-border bg-visor-card safe-bottom"
      >
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); setHistoryIdx(-1); }}
          onKeyDown={handleKeyDown}
          enterKeyHint="send"
          placeholder="Type a message or /command..."
          rows={1}
          className="flex-1 px-4 py-2.5 bg-visor-bg border border-visor-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-visor-accent text-sm resize-none max-h-32 overflow-y-auto"
          style={{ minHeight: "42px" }}
          autoFocus
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="shrink-0 w-10 h-10 flex items-center justify-center bg-visor-accent hover:bg-indigo-600 disabled:opacity-20 text-white rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>
    </div>
  );
}
