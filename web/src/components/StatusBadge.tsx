import type { SessionStatus, SessionType } from "../lib/types";

const STATUS_STYLES: Record<SessionStatus, { dot: string; text: string; label: string }> = {
  running: { dot: "bg-visor-green animate-pulse-dot", text: "text-visor-green", label: "Running" },
  paused: { dot: "bg-visor-yellow", text: "text-visor-yellow", label: "Paused" },
  stopped: { dot: "bg-gray-500", text: "text-gray-400", label: "Stopped" },
  error: { dot: "bg-visor-red", text: "text-visor-red", label: "Error" },
  suspended: { dot: "bg-blue-500", text: "text-blue-400", label: "Suspended" },
};

const TYPE_STYLES: Record<SessionType, { bg: string; text: string; label: string }> = {
  "claude-code": { bg: "bg-orange-500/15", text: "text-orange-400", label: "Claude Code" },
  opencode: { bg: "bg-blue-500/15", text: "text-blue-400", label: "opencode" },
  ollama: { bg: "bg-purple-500/15", text: "text-purple-400", label: "Ollama" },
  custom: { bg: "bg-gray-500/15", text: "text-gray-400", label: "Custom" },
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs md:text-sm ${style.text}`}>
      <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: SessionType }) {
  const style = TYPE_STYLES[type];
  return (
    <span className={`inline-flex items-center px-2 md:px-2.5 py-0.5 md:py-1 rounded text-xs md:text-sm font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
