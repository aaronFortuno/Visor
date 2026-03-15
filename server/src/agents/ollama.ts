import { Hono } from "hono";

/**
 * Ollama Bridge — proxies requests to the local Ollama API.
 * This allows the web UI to chat with local models directly
 * without needing a PTY session.
 */

const OLLAMA_BASE = process.env.OLLAMA_HOST || "http://localhost:11434";

export const ollamaRouter = new Hono();

// List available models
ollamaRouter.get("/models", async (c) => {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    const data = await res.json();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: "Ollama not reachable", detail: err.message }, 502);
  }
});

// Chat with a model (streaming)
ollamaRouter.post("/chat", async (c) => {
  const body = await c.req.json();

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return c.json({ error: "Ollama error", status: res.status }, 502);
    }

    // Stream the response through
    if (body.stream !== false && res.body) {
      c.header("Content-Type", "application/x-ndjson");
      return c.body(res.body as any);
    }

    const data = await res.json();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: "Ollama not reachable", detail: err.message }, 502);
  }
});

// Generate (non-chat completions)
ollamaRouter.post("/generate", async (c) => {
  const body = await c.req.json();

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return c.json({ error: "Ollama error", status: res.status }, 502);
    }

    if (body.stream !== false && res.body) {
      c.header("Content-Type", "application/x-ndjson");
      return c.body(res.body as any);
    }

    const data = await res.json();
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: "Ollama not reachable", detail: err.message }, 502);
  }
});
