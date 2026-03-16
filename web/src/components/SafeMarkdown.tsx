import { Component, type ReactNode } from "react";
import { MarkdownMessage } from "./MarkdownMessage";

// ── SafeMarkdown ──────────────────────────────────────────
// Error boundary wrapper around MarkdownMessage. If markdown
// rendering throws, it falls back to displaying raw text.

interface SafeMarkdownState { hasError: boolean }

class MarkdownErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, SafeMarkdownState> {
  state: SafeMarkdownState = { hasError: false };
  static getDerivedStateFromError(): SafeMarkdownState { return { hasError: true }; }
  componentDidCatch() {}
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

export function SafeMarkdown({ content }: { content: string }) {
  return (
    <MarkdownErrorBoundary fallback={<pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono">{content}</pre>}>
      <MarkdownMessage content={content} />
    </MarkdownErrorBoundary>
  );
}
