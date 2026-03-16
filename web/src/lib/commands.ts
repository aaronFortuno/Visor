import type { SessionType } from "./types";

// ── Slash commands per agent type ──────────────────────────

export interface SlashCommand {
  command: string;
  description: string;
  /** If true, command is sent as-is. If false, opens input with prefix. */
  direct?: boolean;
}

const SLASH_COMMANDS: Record<string, SlashCommand[]> = {
  "claude-code": [
    { command: "/help", description: "Show help", direct: true },
    { command: "/clear", description: "Clear conversation", direct: true },
    { command: "/compact", description: "Compact context", direct: true },
    { command: "/model ", description: "Switch model", direct: false },
    { command: "/cost", description: "Token usage & cost", direct: true },
    { command: "/permissions", description: "View permissions", direct: true },
    { command: "/config", description: "View configuration", direct: true },
    { command: "/doctor", description: "Run diagnostics", direct: true },
    { command: "/login", description: "Login/switch account", direct: true },
    { command: "/logout", description: "Logout", direct: true },
    { command: "/vim", description: "Enter vim mode", direct: true },
    { command: "/terminal-setup", description: "Terminal integration", direct: true },
  ],
  opencode: [
    { command: "/help", description: "Show help", direct: true },
    { command: "/clear", description: "Clear conversation", direct: true },
    { command: "/compact", description: "Compact context", direct: true },
    { command: "/model ", description: "Switch model", direct: false },
    { command: "/cost", description: "Token usage & cost", direct: true },
    { command: "/providers", description: "List providers", direct: true },
    { command: "/sessions", description: "List sessions", direct: true },
    { command: "/diff", description: "Show pending diffs", direct: true },
    { command: "/undo", description: "Undo last change", direct: true },
    { command: "/theme ", description: "Change theme", direct: false },
  ],
  ollama: [],
  custom: [],
};

// ── Context actions per agent type ─────────────────────────

export interface ContextAction {
  label: string;
  icon: string;
  action: string;
  color: string;
}

const CONTEXT_ACTIONS: Record<string, ContextAction[]> = {
  "claude-code": [
    { label: "Compact", icon: "compress", action: "/compact\r", color: "text-blue-400" },
    { label: "Cost", icon: "dollar", action: "/cost\r", color: "text-green-400" },
    { label: "Clear", icon: "trash", action: "/clear\r", color: "text-yellow-400" },
    { label: "Cancel", icon: "stop", action: "\x03", color: "text-red-400" },
  ],
  opencode: [
    { label: "Compact", icon: "compress", action: "/compact\r", color: "text-blue-400" },
    { label: "Cost", icon: "dollar", action: "/cost\r", color: "text-green-400" },
    { label: "Diff", icon: "diff", action: "/diff\r", color: "text-purple-400" },
    { label: "Undo", icon: "undo", action: "/undo\r", color: "text-yellow-400" },
    { label: "Cancel", icon: "stop", action: "\x03", color: "text-red-400" },
  ],
  ollama: [
    { label: "Cancel", icon: "stop", action: "\x03", color: "text-red-400" },
  ],
  custom: [
    { label: "Cancel", icon: "stop", action: "\x03", color: "text-red-400" },
    { label: "Clear", icon: "trash", action: "\x0c", color: "text-yellow-400" },
  ],
};

export function getSlashCommands(type: SessionType): SlashCommand[] {
  return SLASH_COMMANDS[type] || [];
}

export function getContextActions(type: SessionType): ContextAction[] {
  return CONTEXT_ACTIONS[type] || [];
}
