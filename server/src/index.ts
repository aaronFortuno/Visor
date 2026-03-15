import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";

import { loadConfig } from "./core/config.ts";
import { initDatabase, saveDatabase } from "./db/database.ts";
import { authMiddleware } from "./api/auth.ts";
import { api } from "./api/routes.ts";
import { handleWsOpen, handleWsMessage, handleWsClose } from "./ws/handler.ts";
import { restoreSuspendedSessions, suspendAllSessions, watchdogCheck } from "./core/session-manager.ts";

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

  app.use("*", logger());
  app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }));

  app.use("/api/*", authMiddleware(config.authToken));

  // ── Routes ───────────────────────────────────────────────

  app.route("/api", api);

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
    saveDatabase();
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
