import { Hono } from "hono";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  createAndStartSession, createSession, startSession, stopSession,
  removeSession, sendInput, resizeSession, getSession, listSessions, restartSession,
  renameSession,
} from "../core/session-manager.ts";
import { getEvents, getEventCount } from "../db/database.ts";
import type { CreateSessionOpts, SessionType } from "../core/types.ts";

// ── Cached health config (computed once at module load) ────
const serverPlatform = process.platform;
const serverShell = process.env.VISOR_SHELL || (process.platform === "win32" ? "powershell.exe" : "/bin/bash");

const VALID_SESSION_TYPES: SessionType[] = ["claude-code", "opencode", "ollama", "custom"];

export const api = new Hono();

api.get("/sessions", (c) => c.json({ sessions: listSessions() }));

api.get("/sessions/:id", (c) => {
  const session = getSession(c.req.param("id"));
  return session ? c.json({ session }) : c.json({ error: "Not found" }, 404);
});

api.post("/sessions", async (c) => {
  const body = await c.req.json<CreateSessionOpts & { autoStart?: boolean }>();

  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    return c.json({ error: "name is required and must be a non-empty string" }, 400);
  }
  if (!body.type || !VALID_SESSION_TYPES.includes(body.type)) {
    return c.json({ error: `type must be one of: ${VALID_SESSION_TYPES.join(", ")}` }, 400);
  }
  if (!body.command || typeof body.command !== "string" || body.command.trim() === "") {
    return c.json({ error: "command is required and must be a non-empty string" }, 400);
  }

  const { autoStart = true, ...opts } = body;
  try {
    const session = autoStart ? createAndStartSession(opts) : createSession(opts);
    return c.json({ session }, 201);
  } catch (err: any) { return c.json({ error: err.message }, 400); }
});

api.patch("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string }>();
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return c.json({ error: "name is required and must be a non-empty string" }, 400);
  }
  try {
    const session = renameSession(id, body.name.trim());
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json({ session });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

api.delete("/sessions/:id", (c) => {
  try { removeSession(c.req.param("id")); return c.json({ ok: true }); }
  catch (err: any) { return c.json({ error: err.message }, 404); }
});

api.post("/sessions/:id/start", (c) => {
  try { return c.json({ session: startSession(c.req.param("id")) }); }
  catch (err: any) { return c.json({ error: err.message }, 400); }
});

api.post("/sessions/:id/stop", (c) => {
  try { return c.json({ session: stopSession(c.req.param("id")) }); }
  catch (err: any) { return c.json({ error: err.message }, 400); }
});

api.post("/sessions/:id/restart", (c) => {
  try { return c.json({ session: restartSession(c.req.param("id")) }); }
  catch (err: any) { return c.json({ error: err.message }, 400); }
});

api.post("/sessions/:id/input", async (c) => {
  const body = await c.req.json<{ data: string }>();
  if (typeof body.data !== "string") {
    return c.json({ error: "data is required and must be a string" }, 400);
  }
  try { sendInput(c.req.param("id"), body.data); return c.json({ ok: true }); }
  catch (err: any) { return c.json({ error: err.message }, 400); }
});

api.post("/sessions/:id/resize", async (c) => {
  const body = await c.req.json<{ cols: number; rows: number }>();
  if (!Number.isInteger(body.cols) || body.cols <= 0) {
    return c.json({ error: "cols must be a positive integer" }, 400);
  }
  if (!Number.isInteger(body.rows) || body.rows <= 0) {
    return c.json({ error: "rows must be a positive integer" }, 400);
  }
  try { resizeSession(c.req.param("id"), body.cols, body.rows); return c.json({ ok: true }); }
  catch (err: any) { return c.json({ error: err.message }, 400); }
});

api.get("/sessions/:id/events", (c) => {
  const id = c.req.param("id");
  const url = new URL(c.req.url);
  const limit = parseInt(url.searchParams.get("limit") || "200");
  const after = parseInt(url.searchParams.get("after") || "0");

  try {
    const events = getEvents(id, { limit, after });
    const total = getEventCount(id);
    return c.json({ events, total });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

api.get("/health", (c) => {
  return c.json({
    status: "ok",
    uptime: process.uptime(),
    sessions: listSessions().length,
    platform: serverPlatform,
    defaultShell: serverShell,
  });
});

// ── Projects discovery ─────────────────────────────────────

const PROJECT_MARKERS = [".git", "package.json", "go.mod", "Cargo.toml", "pyproject.toml", "pom.xml", ".sln", "Makefile"];
const PROJECTS_ROOTS = [
  join(homedir(), "Projects"),
  join(homedir(), "projects"),
  join(homedir(), "repos"),
  join(homedir(), "dev"),
  join(homedir(), "src"),
  join(homedir(), "code"),
  join(homedir(), "workspace"),
  join(homedir(), "Documents", "Projects"),
];

function discoverProjects(): Array<{ name: string; path: string; markers: string[] }> {
  const projects: Array<{ name: string; path: string; markers: string[] }> = [];
  const seen = new Set<string>();

  for (const root of PROJECTS_ROOTS) {
    if (!existsSync(root)) continue;
    try {
      const entries = readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

        const dirPath = join(root, entry.name);
        const normalizedPath = dirPath.replace(/\\/g, "/").toLowerCase();
        if (seen.has(normalizedPath)) continue;
        seen.add(normalizedPath);

        const foundMarkers: string[] = [];
        for (const marker of PROJECT_MARKERS) {
          if (existsSync(join(dirPath, marker))) foundMarkers.push(marker);
        }

        // Include directories that have project markers or are direct children of a projects folder
        if (foundMarkers.length > 0 || root.toLowerCase().includes("project")) {
          projects.push({
            name: entry.name,
            path: normalizedPath,
            markers: foundMarkers,
          });
        }
      }
    } catch { /* permission denied, etc. */ }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

api.get("/projects", (c) => {
  return c.json({ projects: discoverProjects() });
});
