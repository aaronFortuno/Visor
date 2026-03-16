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

// ── Projects ───────────────────────────────────────────────

export async function fetchProjects(): Promise<Array<{ name: string; path: string; markers: string[] }>> {
  const res = handleResponse(await fetch("/api/projects", { headers: headers() }));
  if (!res.ok) return [];
  const data = await res.json();
  return data.projects || [];
}

// ── Sessions ───────────────────────────────────────────────

export async function fetchSessions(): Promise<Session[]> {
  const res = handleResponse(await fetch("/api/sessions", { headers: headers() }));
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  return data.sessions;
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

// ── Events ─────────────────────────────────────────────────

export async function fetchEvents(
  id: string,
  opts?: { limit?: number; after?: number }
): Promise<{ events: Array<{ id: number; sessionId: string; kind: string; data: string; timestamp: string }>; total: number }> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.after) params.set("after", String(opts.after));
  const res = handleResponse(await fetch(`/api/sessions/${id}/events?${params}`, { headers: headers() }));
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function renameSession(id: string, name: string): Promise<Session> {
  const res = handleResponse(await fetch(`/api/sessions/${id}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ name }),
  }));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.session;
}

// ── Ollama ─────────────────────────────────────────────────

export async function fetchOllamaModels(): Promise<Array<{ name: string; size: number }>> {
  try {
    const res = handleResponse(await fetch("/api/ollama/models", { headers: headers() }));
    if (!res.ok) return []; // Ollama may not be running
    const data = await res.json();
    return data.models || [];
  } catch {
    return [];
  }
}

export async function ollamaChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/ollama/chat", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error("Ollama request failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content) onChunk(json.message.content);
      } catch { /* skip malformed lines */ }
    }
  }
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
