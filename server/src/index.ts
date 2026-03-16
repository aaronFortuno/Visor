import { Hono } from "hono";
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";

import { loadConfig } from "./core/config.ts";
import { initDatabase, closeDatabase } from "./db/database.ts";
import { authMiddleware } from "./api/auth.ts";
import { api } from "./api/routes.ts";
import { ollamaRouter } from "./agents/ollama.ts";
import { handleWsOpen, handleWsMessage, handleWsClose } from "./ws/handler.ts";
import { restoreSuspendedSessions, suspendAllSessions, watchdogCheck } from "./core/session-manager.ts";

// ── Rate limiter ───────────────────────────────────────────

// Simple in-memory rate limiter
function rateLimiter(maxRequests: number, windowMs: number) {
  const requests = new Map<string, { count: number; resetAt: number }>();

  // Cleanup stale entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of requests) {
      if (val.resetAt < now) requests.delete(key);
    }
  }, 60_000);

  return async (c: Context, next: Next) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const now = Date.now();
    const entry = requests.get(ip);

    if (!entry || entry.resetAt < now) {
      requests.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return c.json({ error: "Too many requests" }, 429);
    }
    return next();
  };
}

// ── Bootstrap ──────────────────────────────────────────────

async function main() {
  const config = loadConfig();
  await initDatabase(config.dbPath);

  // ── Restore sessions from previous run ───────────────────

  const restored = restoreSuspendedSessions();
  if (restored > 0) {
    console.log(`  → Restored ${restored} suspended session(s)`);
  }

  // ── Watchdog: periodic health check ──────────────────────

  const watchdogInterval = setInterval(watchdogCheck, 30_000);

  // ── App setup ────────────────────────────────────────────

  const app = new Hono();

  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  // Custom logger that masks token values in URLs
  app.use("*", async (c, next) => {
    const start = Date.now();
    await next();
    const url = c.req.url.replace(/token=[^&]+/, "token=***");
    const parsed = new URL(url);
    const status = c.res.status;
    const ms = Date.now() - start;
    console.log(`  ${c.req.method} ${parsed.pathname}${parsed.search} ${status} ${ms}ms`);
  });

  app.use("*", cors({
    origin: config.corsOrigin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }));

  // Security headers
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-XSS-Protection", "0");
  });

  // Rate limit API routes: 200 requests per minute per IP
  app.use("/api/*", rateLimiter(200, 60_000));

  app.use("/api/*", authMiddleware(config.authToken));

  // ── Routes ───────────────────────────────────────────────

  app.route("/api", api);
  app.route("/api/ollama", ollamaRouter);

  // ── WebSocket with token validation ─────────────────────

  app.get("/ws", (c, next) => {
    const token = new URL(c.req.url).searchParams.get("token");
    if (token !== config.authToken) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return next();
  });

  app.get(
    "/ws",
    upgradeWebSocket(() => ({
      onOpen(_event, ws) { handleWsOpen(ws); },
      onMessage(event, ws) { handleWsMessage(ws, event.data as string); },
      onClose(_event, ws) { handleWsClose(ws); },
    }))
  );

  // ── Static frontend ──────────────────────────────────────

  const webDistPath = resolve(import.meta.dirname, "../../web/dist");
  const hasWebDist = existsSync(webDistPath);

  if (hasWebDist) {
    const relativeRoot = "./" + relative(process.cwd(), webDistPath).replace(/\\/g, "/");
    app.use("/*", serveStatic({ root: relativeRoot }));
    app.get("*", serveStatic({ root: relativeRoot, path: "index.html" }));
  }

  // ── Start server ─────────────────────────────────────────

  const server = serve(
    { fetch: app.fetch, port: config.port, hostname: config.host },
    () => {
      console.log("");
      console.log("  ╔══════════════════════════════════════╗");
      console.log("  ║           VISOR DAEMON               ║");
      console.log("  ╚══════════════════════════════════════╝");
      console.log("");
      console.log(`  → HTTP:  http://${config.host}:${config.port}`);
      console.log(`  → WS:    ws://${config.host}:${config.port}/ws`);
      console.log(`  → API:   http://${config.host}:${config.port}/api`);
      if (hasWebDist) {
        console.log(`  → UI:    ${webDistPath}`);
      } else {
        console.log(`  → UI:    Not found. Run "npm run build:web" first.`);
      }
      console.log("");
    }
  );

  injectWebSocket(server);

  // ── Graceful shutdown ────────────────────────────────────

  function shutdown() {
    console.log("\n  [visor] Shutting down...");
    clearInterval(watchdogInterval);
    suspendAllSessions();
    closeDatabase();
    console.log("  [visor] Goodbye.\n");
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
