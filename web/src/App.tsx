import { useState, useCallback } from "react";
import { hasToken } from "./lib/api";
import { useWebSocket } from "./hooks/useWebSocket";
import { LoginScreen } from "./components/LoginScreen";
import { Dashboard } from "./components/Dashboard";
import { SessionView } from "./components/SessionView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { Session } from "./lib/types";

function App() {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const { connected, sessions, subscribe, unsubscribe, sendInput, resize, onOutput } = useWebSocket();

  const handleSelect = useCallback((s: Session) => setActiveSession(s), []);
  const handleBack = useCallback(() => setActiveSession(null), []);

  if (!hasToken()) return <LoginScreen />;

  const current = activeSession
    ? sessions.find((s) => s.id === activeSession.id) || activeSession
    : null;

  return (
    <div className="h-dvh flex flex-col">
      {current ? (
        <ErrorBoundary fallbackMessage="Session view crashed unexpectedly">
          <SessionView
            session={current}
            onBack={handleBack}
            wsSubscribe={subscribe}
            wsUnsubscribe={unsubscribe}
            wsSendInput={sendInput}
            wsResize={resize}
            onOutput={onOutput}
          />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary fallbackMessage="Dashboard crashed unexpectedly">
          <Dashboard sessions={sessions} onSelectSession={handleSelect} connected={connected} />
        </ErrorBoundary>
      )}
    </div>
  );
}

export default App;
