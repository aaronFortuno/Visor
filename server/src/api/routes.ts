import { Hono } from "hono";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "../core/config.ts";
import {
  createAndStartSession, createSession, startSession, stopSession,
  removeSession, sendInput, resizeSession, getSession, listSessions, restartSession,
} from "../core/session-manager.ts";
import type { CreateSessionOpts } from "../core/types.ts";

export const api = new Hono();

api.get("/sessions", (c) => c.json({ sessions: listSessions() }));

api.get("/sessions/:id", (c) => {
  const session = getSession(c.req.param("id"));
  return session ? c.json({ session }) : c.json({ error: "Not found" }, 404);
});

api.post("/sessions", async (c) => {
  const body = await c.req.json<CreateSessionOpts & { autoStart?: boolean }>();
  const { autoStart = true, ...opts } = body;
  try {
    const session = autoStart ? createAndStartSession(opts) : createSession(opts);
    return c.json({ session }, 201);
  } catch (err: any) { return c.json({ error: err.message }, 400); }
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
  const { data } = await c.req.json<{ data: string }>();
  try { sendInput(c.req.param("id"), data); return c.json({ ok: true }); }
  catch (err: any) { return c.json({ error: err.message }, 400); }
});

api.post("/sessions/:id/resize", async (c) => {
  const { cols, rows } = await c.req.json<{ cols: number; rows: number }>();
  try { resizeSession(c.req.param("id"), cols, rows); return c.json({ ok: true }); }
  catch (err: any) { return c.json({ error: err.message }, 400); }
});

api.get("/health", (c) => {
  const config = loadConfig();
  return c.json({
    status: "ok",
    uptime: process.uptime(),
    sessions: listSessions().length,
    platform: process.platform,
    defaultShell: config.defaultShell,
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
