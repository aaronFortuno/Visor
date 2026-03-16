import { useState, useRef, useEffect, useCallback } from "react";
import type { SessionType } from "../lib/types";
import { getSlashCommands, getContextActions, type SlashCommand } from "../lib/commands";
import { useInputHistory } from "../hooks/useInputHistory";

interface Props {
  sessionType: SessionType;
  onSend: (data: string) => void;
  onBack: () => void;
}

// ── Special key definitions ────────────────────────────────

interface KeyDef {
  label: string;
  value: string;
}

const KEYS_NAV: KeyDef[] = [
  { label: "Tab", value: "\t" },
  { label: "S+Tab", value: "\x1b[Z" },
  { label: "Esc", value: "\x1b" },
  { label: "\u2191", value: "\x1b[A" },
  { label: "\u2193", value: "\x1b[B" },
  { label: "\u2190", value: "\x1b[D" },
  { label: "\u2192", value: "\x1b[C" },
];

const KEYS_CTRL: KeyDef[] = [
  { label: "Ctrl+C", value: "\x03" },
  { label: "Ctrl+D", value: "\x04" },
  { label: "Ctrl+Z", value: "\x1a" },
  { label: "Ctrl+L", value: "\x0c" },
  { label: "Enter", value: "\r" },
  { label: "y", value: "y\r" },
  { label: "n", value: "n\r" },
];

function ActionIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "compress":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
        </svg>
      );
    case "dollar":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "trash":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      );
    case "stop":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
        </svg>
      );
    case "diff":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
    case "undo":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
      );
    default:
      return null;
  }
}

// ── Component ──────────────────────────────────────────────

type Panel = "none" | "slash" | "input" | "actions";

export function MobileToolbar({ sessionType, onSend, onBack }: Props) {
  const [activePanel, setActivePanel] = useState<Panel>("none");
  const [inputText, setInputText] = useState("");
  const { history: inputHistory, addToHistory, navigateUp, navigateDown, resetNavigation } = useInputHistory();
  const [slashFilter, setSlashFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const slashFilterRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef(0);

  const slashCommands = getSlashCommands(sessionType);
  const contextActions = getContextActions(sessionType);

  const filteredSlash = slashFilter
    ? slashCommands.filter((c) => c.command.toLowerCase().includes(slashFilter.toLowerCase()))
    : slashCommands;

  useEffect(() => {
    if (activePanel === "input") inputRef.current?.focus();
    if (activePanel === "slash") slashFilterRef.current?.focus();
  }, [activePanel]);

  const togglePanel = (panel: Panel) => {
    setActivePanel((prev) => (prev === panel ? "none" : panel));
    setSlashFilter("");
  };

  // ── Input handling ───────────────────────────────────────

  const handleSendInput = () => {
    const text = inputText.trim();
    if (!text) return;

    onSend(text + "\r");
    addToHistory(text);

    setInputText("");
  };

  const handleHistoryNav = (direction: "up" | "down") => {
    if (direction === "up") {
      const val = navigateUp(inputText);
      if (val !== null) setInputText(val);
    } else {
      const val = navigateDown();
      if (val !== null) setInputText(val);
    }
  };

  const handleSlashSelect = (cmd: SlashCommand) => {
    if (cmd.direct !== false) {
      onSend(cmd.command + "\r");
      setActivePanel("none");
    } else {
      // Open input with the command as prefix
      setInputText(cmd.command);
      setActivePanel("input");
    }
    setSlashFilter("");
  };

  // ── Swipe gesture: right swipe = back to dashboard ───────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    // Swipe right > 100px from left edge = go back
    if (dx > 100 && touchStartX.current < 50) {
      onBack();
    }
  }, [onBack]);

  return (
    <div
      className="shrink-0 border-t border-visor-border bg-visor-card safe-bottom md:hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Expandable panels ─────────────────────────────── */}

      {/* Slash command selector */}
      {activePanel === "slash" && slashCommands.length > 0 && (
        <div className="border-b border-visor-border animate-fade-in">
          {/* Search filter */}
          <div className="px-3 py-2 border-b border-visor-border/50">
            <input
              ref={slashFilterRef}
              type="text"
              value={slashFilter}
              onChange={(e) => setSlashFilter(e.target.value)}
              placeholder="Search commands..."
              className="w-full px-3 py-1.5 bg-visor-bg border border-visor-border rounded text-white placeholder-gray-500 focus:outline-none focus:border-visor-accent text-sm"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredSlash.map((cmd) => (
              <button
                key={cmd.command}
                onClick={() => handleSlashSelect(cmd)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-visor-bg active:bg-visor-accent/10 transition-colors text-left"
              >
                <span className="text-visor-accent font-mono text-sm font-medium min-w-[100px]">
                  {cmd.command}
                </span>
                <span className="text-gray-500 text-xs truncate">
                  {cmd.description}
                </span>
              </button>
            ))}
            {filteredSlash.length === 0 && (
              <p className="px-4 py-3 text-gray-500 text-sm">No commands match "{slashFilter}"</p>
            )}
          </div>
        </div>
      )}

      {/* Text input with history */}
      {activePanel === "input" && (
        <div className="border-b border-visor-border animate-fade-in">
          {/* History chips */}
          {inputHistory.length > 0 && (
            <div className="flex gap-1.5 px-3 pt-2 pb-1 overflow-x-auto">
              {inputHistory.slice(0, 8).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setInputText(h); inputRef.current?.focus(); }}
                  className="shrink-0 px-2 py-0.5 bg-visor-bg border border-visor-border rounded text-xs text-gray-400 hover:text-white hover:border-visor-accent transition-colors font-mono truncate max-w-[150px]"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              onClick={() => handleHistoryNav("up")}
              className="p-1.5 text-gray-500 hover:text-white active:text-visor-accent"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => { setInputText(e.target.value); resetNavigation(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSendInput(); }
                if (e.key === "ArrowUp") { e.preventDefault(); handleHistoryNav("up"); }
                if (e.key === "ArrowDown") { e.preventDefault(); handleHistoryNav("down"); }
              }}
              placeholder="Type message or prompt..."
              className="flex-1 px-3 py-2 bg-visor-bg border border-visor-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-visor-accent text-sm font-mono"
            />
            <button
              onClick={handleSendInput}
              disabled={!inputText.trim()}
              className="px-4 py-2 bg-visor-accent hover:bg-indigo-600 disabled:opacity-30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Context actions */}
      {activePanel === "actions" && contextActions.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-visor-border animate-fade-in overflow-x-auto">
          {contextActions.map((action) => (
            <button
              key={action.label}
              onClick={() => onSend(action.action)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 bg-visor-bg border border-visor-border rounded-lg text-xs font-medium hover:border-visor-accent active:bg-visor-accent/10 transition-colors ${action.color}`}
            >
              <ActionIcon icon={action.icon} />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Key rows (always visible) ─────────────────────── */}

      {/* Row 1: Navigation keys */}
      <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto">
        {KEYS_NAV.map((key) => (
          <button
            key={key.label}
            onClick={() => onSend(key.value)}
            className="shrink-0 px-2.5 py-1.5 bg-visor-bg border border-visor-border rounded text-xs text-gray-300 hover:text-white active:bg-visor-accent/20 active:border-visor-accent transition-colors font-mono"
          >
            {key.label}
          </button>
        ))}
      </div>

      {/* Row 2: Ctrl keys + panel toggles */}
      <div className="flex items-center gap-1 px-2 py-1 pb-2 overflow-x-auto">
        {KEYS_CTRL.map((key) => (
          <button
            key={key.label}
            onClick={() => onSend(key.value)}
            className="shrink-0 px-2.5 py-1.5 bg-visor-bg border border-visor-border rounded text-xs text-gray-300 hover:text-white active:bg-visor-accent/20 active:border-visor-accent transition-colors font-mono"
          >
            {key.label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Context actions toggle */}
        {contextActions.length > 0 && (
          <button
            onClick={() => togglePanel("actions")}
            className={`shrink-0 p-1.5 rounded transition-colors ${
              activePanel === "actions"
                ? "bg-visor-accent text-white"
                : "bg-visor-bg border border-visor-border text-gray-400"
            }`}
            title="Quick actions"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </button>
        )}

        {/* Slash commands toggle */}
        {slashCommands.length > 0 && (
          <button
            onClick={() => togglePanel("slash")}
            className={`shrink-0 w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
              activePanel === "slash"
                ? "bg-visor-accent text-white"
                : "bg-visor-bg border border-visor-border text-visor-accent"
            }`}
          >
            /
          </button>
        )}

        {/* Text input toggle */}
        <button
          onClick={() => togglePanel("input")}
          className={`shrink-0 p-1.5 rounded transition-colors ${
            activePanel === "input"
              ? "bg-visor-accent text-white"
              : "bg-visor-bg border border-visor-border text-gray-400"
          }`}
          title="Message input"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
