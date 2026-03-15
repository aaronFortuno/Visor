import { useState, useRef, useEffect } from "react";

interface Props {
  onSend: (text: string) => void;
  onClose: () => void;
}

/**
 * Mobile-friendly text input bar for sending messages to a session.
 * This is an alternative to typing directly in the xterm terminal,
 * which can be finicky on mobile keyboards.
 */
export function QuickInput({ onSend, onClose: _onClose }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text);
      setText("");
    }
  };

  // Quick action buttons for common inputs
  const quickActions = [
    { label: "Enter", value: "\r" },
    { label: "y", value: "y\r" },
    { label: "n", value: "n\r" },
    { label: "Ctrl+C", value: "\x03" },
    { label: "Ctrl+D", value: "\x04" },
  ];

  return (
    <div className="px-4 py-3 border-b border-visor-border bg-visor-card/80 shrink-0 animate-fade-in">
      {/* Quick action buttons */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onSend(action.value)}
            className="px-3 py-1 bg-visor-bg border border-visor-border rounded-lg text-xs text-gray-300 hover:border-visor-accent hover:text-white transition-colors whitespace-nowrap"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Text input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message or command..."
          className="flex-1 px-3 py-2 bg-visor-bg border border-visor-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-visor-accent text-sm"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-4 py-2 bg-visor-accent hover:bg-indigo-600 disabled:opacity-30 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
