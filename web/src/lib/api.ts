import type { Session } from "./types";

// ── Token management ───────────────────────────────────────

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

/** Validate a token against the server before storing it */
export async function validateAndSetToken(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/health", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    localStorage.setItem("visor-token", token);
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export function clearToken(): void {
  localStorage.removeItem("visor-token");
  window.location.reload();
}

export function getToken(): string {
  return localStorage.getItem("visor-token") || "";
}

export function hasToken(): boolean {
  return !!localStorage.getItem("visor-token");
}

// ── 401 handler ────────────────────────────────────────────

function handleResponse(res: Response): Response {
  if (res.status === 401) {
    clearToken();
  }
  return res;
}

// ── Sessions ───────────────────────────────────────────────

export async function fetchSessions(): Promise<Session[]> {
  const res = handleResponse(await fetch("/api/sessions", { headers: headers() }));
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  return data.sessions;
}

export async function fetchSession(id: string): Promise<Session> {
  const res = handleResponse(await fetch(`/api/sessions/${id}`, { headers: headers() }));
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
  const res = handleResponse(await fetch("/api/sessions", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(opts),
  }));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.session;
}

export async function deleteSession(id: string): Promise<void> {
  const res = handleResponse(await fetch(`/api/sessions/${id}`, {
    method: "DELETE",
    headers: headers(),
  }));
  if (!res.ok) throw new Error(`${res.status}`);
}

export async function controlSession(
  id: string,
  action: "start" | "stop" | "restart"
): Promise<Session> {
  const res = handleResponse(await fetch(`/api/sessions/${id}/${action}`, {
    method: "POST",
    headers: headers(),
  }));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.session;
}

export async function sendInput(id: string, data: string): Promise<void> {
  const res = handleResponse(await fetch(`/api/sessions/${id}/input`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ data }),
  }));
  if (!res.ok) throw new Error(`${res.status}`);
}

// ── Server info ────────────────────────────────────────────

export async function fetchServerInfo(): Promise<{
  status: string;
  uptime: number;
  sessions: number;
  platform: string;
  defaultShell: string;
}> {
  const res = handleResponse(await fetch("/api/health", { headers: headers() }));
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
