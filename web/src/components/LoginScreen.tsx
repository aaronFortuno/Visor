import { useState } from "react";
import { setToken } from "../lib/api";

export function LoginScreen() {
  const [token, setTokenValue] = useState("");
  const [showToken, setShowToken] = useState(true);
  const [pasteError, setPasteError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      setToken(token.trim());
    }
  };

  const handlePaste = async () => {
    setPasteError("");
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setTokenValue(text.trim());
      }
    } catch {
      // Clipboard API denied — fallback message
      setPasteError("Clipboard access denied. Long-press the input field to paste manually.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm md:max-w-md">
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Visor</h1>
          <p className="text-gray-400 text-sm md:text-base">Remote agent session manager</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm md:text-base text-gray-400 mb-1 md:mb-2">
              Auth Token
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setTokenValue(e.target.value)}
                placeholder="Paste your token here"
                className="w-full px-4 py-3 md:py-3.5 pr-20 bg-visor-card border border-visor-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-visor-accent font-mono text-sm md:text-base"
                autoFocus
              />
              {/* Toggle visibility */}
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                title={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Paste button — big and easy to tap on mobile */}
          <button
            type="button"
            onClick={handlePaste}
            className="w-full py-3 border border-dashed border-visor-border rounded-lg text-gray-400 hover:text-white hover:border-visor-accent transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            Paste from clipboard
          </button>

          {pasteError && (
            <p className="text-visor-yellow text-xs text-center">{pasteError}</p>
          )}

          {/* Show preview of pasted token */}
          {token && (
            <p className="text-xs text-gray-500 text-center font-mono">
              {token.slice(0, 8)}...{token.slice(-8)} ({token.length} chars)
            </p>
          )}

          <button
            type="submit"
            disabled={!token.trim()}
            className="w-full py-3 bg-visor-accent hover:bg-indigo-600 disabled:opacity-30 text-white rounded-lg font-medium transition-colors"
          >
            Connect
          </button>

          <p className="text-xs text-gray-500 text-center">
            Find the token in the server startup output or in the .env file.
          </p>
        </form>
      </div>
    </div>
  );
}
