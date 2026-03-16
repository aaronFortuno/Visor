import { useState, useEffect } from "react";
import type { Session } from "../lib/types";
import { fetchSessions, clearToken } from "../lib/api";
import { SessionCard } from "./SessionCard";
import { CreateSessionModal } from "./CreateSessionModal";

interface Props {
  sessions: Session[];
  onSelectSession: (session: Session) => void;
  connected: boolean;
}

export function Dashboard({ sessions, onSelectSession, connected }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [localSessions, setLocalSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (sessions.length > 0) {
      setLocalSessions(sessions);
    } else {
      fetchSessions().then(setLocalSessions).catch(() => {});
    }
  }, [sessions]);

  const filtered = search
    ? localSessions.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.type.toLowerCase().includes(search.toLowerCase()) ||
        s.command.toLowerCase().includes(search.toLowerCase())
      )
    : localSessions;

  const running = filtered.filter((s) => s.status === "running");
  const errored = filtered.filter((s) => s.status === "error");
  const stopped = filtered.filter((s) => s.status !== "running" && s.status !== "error");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-visor-border bg-visor-card shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Visor</h1>
          <span className={`inline-flex items-center gap-1.5 text-xs ${connected ? "text-visor-green" : "text-visor-red"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-visor-green animate-pulse-dot" : "bg-visor-red"}`} />
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {/* Search */}
        {localSessions.length > 0 && (
          <div className="relative flex-1 max-w-xs mx-2">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions..."
              className="w-full pl-8 pr-7 py-1.5 bg-visor-bg border border-visor-border rounded-lg text-xs text-white placeholder-gray-500 outline-none focus:border-visor-accent transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          {/* Notifications toggle */}
          {typeof Notification !== "undefined" && Notification.permission !== "granted" && (
            <button
              onClick={() => Notification.requestPermission()}
              className="p-2 text-gray-500 hover:text-visor-accent transition-colors rounded-lg"
              title="Enable notifications"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </button>
          )}

          {/* Logout */}
          <button
            onClick={clearToken}
            className="p-2 text-gray-500 hover:text-visor-red transition-colors rounded-lg"
            title="Logout"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-visor-accent hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Session
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {localSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-sm mb-2">No sessions yet</p>
            <p className="text-xs">Click "New Session" to launch an agent</p>
          </div>
        ) : (
          <div className="space-y-6">
            {running.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Active ({running.length})
                </h2>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {running.map((s) => (
                    <SessionCard key={s.id} session={s} onClick={() => onSelectSession(s)} />
                  ))}
                </div>
              </section>
            )}

            {errored.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-visor-red uppercase tracking-wider mb-3">
                  Error ({errored.length})
                </h2>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {errored.map((s) => (
                    <SessionCard key={s.id} session={s} onClick={() => onSelectSession(s)} />
                  ))}
                </div>
              </section>
            )}

            {stopped.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Stopped ({stopped.length})
                </h2>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {stopped.map((s) => (
                    <SessionCard key={s.id} session={s} onClick={() => onSelectSession(s)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <CreateSessionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(session) => {
          setLocalSessions((prev) => [session, ...prev]);
          onSelectSession(session);
        }}
      />
    </div>
  );
}
