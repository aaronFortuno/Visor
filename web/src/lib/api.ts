import type { Session, SessionEvent } from "./types";

const TOKEN = localStorage.getItem("visor-token") || "";

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
  };
}

export function setToken(token: string) {
  localStorage.setItem("visor-token", token);
  // Reload to apply
  window.location.reload();
}

export function getToken(): string {
  return localStorage.getItem("visor-token") || "";
}

export function hasToken(): boolean {
  return !!localStorage.getItem("visor-token");
}

// ── Sessions ───────────────────────────────────────────────

export async function fetchSessions(): Promise<Session[]> {
  const res = await fetch("/api/sessions", { headers: headers() });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  return data.sessions;
}

export async function fetchSession(id: string): Promise<Session> {
  const res = await fetch(`/api/sessions/${id}`, { headers: headers() });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  return data.session;
}

export async function createSession(opts: {
  name: string;
  type: string;
  command: string;
  args?: string[];
  cwd?: string;
  autoStart?: boolean;
}): Promise<Session> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `${res.status}`);
  }
  const data = await res.json();
  return data.session;
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`/api/sessions/${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

export async function controlSession(
  id: string,
  action: "start" | "stop" | "restart"
): Promise<Session> {
  const res = await fetch(`/api/sessions/${id}/${action}`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `${res.status}`);
  }
  const data = await res.json();
  return data.session;
}

export async function sendInput(id: string, data: string): Promise<void> {
  const res = await fetch(`/api/sessions/${id}/input`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

export async function fetchEvents(
  id: string,
  opts?: { limit?: number; after?: number }
): Promise<{ events: SessionEvent[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.after) params.set("after", String(opts.after));

  const res = await fetch(`/api/sessions/${id}/events?${params}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Health ─────────────────────────────────────────────────

export async function fetchHealth(): Promise<{
  status: string;
  uptime: number;
  sessions: number;
}> {
  const res = await fetch("/api/health", { headers: headers() });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
