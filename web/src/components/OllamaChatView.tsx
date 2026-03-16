import { useState, useRef, useEffect, useCallback, Component, type ReactNode } from "react";
import type { Session } from "../lib/types";
import { MarkdownMessage } from "./MarkdownMessage";
import { ollamaChat } from "../lib/api";

// ── SafeMarkdown ──────────────────────────────────────────

interface SafeMarkdownState { hasError: boolean }

class MarkdownErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, SafeMarkdownState> {
  state: SafeMarkdownState = { hasError: false };
  static getDerivedStateFromError(): SafeMarkdownState { return { hasError: true }; }
  componentDidCatch() {}
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function SafeMarkdown({ content }: { content: string }) {
  return (
    <MarkdownErrorBoundary fallback={<pre className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono">{content}</pre>}>
      <MarkdownMessage content={content} />
    </MarkdownErrorBoundary>
  );
}

// ── Types ──────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  session: Session; // session.args[0] is the model name
}

// ── Component ──────────────────────────────────────────────

export function OllamaChatView({ session }: Props) {
  const model = session.args?.[0] || "unknown";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-dismiss error after 5s
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText("");
    setIsStreaming(true);
    setError("");
    scrollToBottom();

    // Add empty assistant message that we'll stream into
    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await ollamaChat(
        model,
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        (chunk) => {
          assistantMessage.content += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...assistantMessage };
            return updated;
          });
          scrollToBottom();
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.name === "AbortError") {
        // User cancelled — keep partial response
      } else {
        setError(err.message || "Failed to get response from Ollama");
        // Remove the empty assistant message if there's no content
        if (!assistantMessage.content) {
          setMessages(newMessages);
        }
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (isStreaming) handleCancel();
    setMessages([]);
    setError("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Message area ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-400 mb-1">Chat with {model}</p>
            <p className="text-xs text-gray-600">Send a message to start the conversation</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`animate-fade-in ${msg.role === "user" ? "flex justify-end" : ""}`}
          >
            {msg.role === "user" ? (
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-visor-accent/20 text-indigo-200 border border-visor-accent/30 whitespace-pre-wrap break-words">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[95%] rounded-lg px-3 py-2.5 bg-visor-card border border-visor-border">
                {msg.content ? (
                  <SafeMarkdown content={msg.content} />
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── Error toast ────────────────────────────────────── */}
      {error && (
        <div className="px-3 py-2 bg-visor-red/20 border-t border-visor-red/30 text-visor-red text-xs font-medium animate-fade-in">
          {error}
        </div>
      )}

      {/* ── Action bar ─────────────────────────────────────── */}
      {messages.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-visor-border bg-visor-card">
          <button
            onClick={handleClear}
            className="shrink-0 px-2.5 py-1.5 bg-visor-bg border border-visor-border rounded text-xs text-gray-400 hover:text-white active:bg-visor-red/20 transition-colors"
          >
            Clear chat
          </button>
          <div className="flex-1" />
          <span className="text-[10px] text-gray-600 font-mono">{model}</span>
        </div>
      )}

      {/* ── Input bar ─────────────────────────────────────── */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="flex items-end gap-2 px-3 py-2.5 border-t border-visor-border bg-visor-card safe-bottom"
      >
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          enterKeyHint="send"
          placeholder={isStreaming ? "Waiting for response..." : "Message Ollama..."}
          rows={1}
          disabled={isStreaming}
          className="flex-1 px-3 py-2.5 bg-visor-bg border border-visor-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-visor-accent text-sm resize-none max-h-32 overflow-y-auto disabled:opacity-50"
          style={{ minHeight: "42px" }}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={handleCancel}
            className="shrink-0 w-10 h-10 flex items-center justify-center bg-visor-red/80 hover:bg-red-600 text-white rounded-xl transition-colors"
            title="Stop generating"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="shrink-0 w-10 h-10 flex items-center justify-center bg-visor-accent hover:bg-indigo-600 disabled:opacity-20 text-white rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        )}
      </form>
    </div>
  );
}
