import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { existsSync } from "node:fs";
import { resolve, relative } from "node:path";

import { loadConfig } from "./core/config.ts";
import { initDatabase } from "./db/database.ts";
import { authMiddleware } from "./api/auth.ts";
import { api } from "./api/routes.ts";
import { handleWsOpen, handleWsMessage, handleWsClose } from "./ws/handler.ts";

// ── Bootstrap ──────────────────────────────────────────────

async function main() {
  const config = loadConfig();
  await initDatabase(config.dbPath);

  // ── App setup ────────────────────────────────────────────

  const app = new Hono();

  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  // Middleware
  app.use("*", logger());
  app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }));

  // Auth on API routes only (not static files)
  app.use("/api/*", authMiddleware(config.authToken));

  // ── Routes ───────────────────────────────────────────────

  // REST API
  app.route("/api", api);

  // WebSocket endpoint (session list updates, notifications)
  app.get(
    "/ws",
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        handleWsOpen(ws);
      },
      onMessage(event, ws) {
        handleWsMessage(ws, event.data as string);
      },
      onClose(_event, ws) {
        handleWsClose(ws);
      },
    }))
  );

  // ── Static frontend ──────────────────────────────────────
  // Serve the built web UI from ../web/dist if it exists.
  // This enables single-port deployment: one URL for API + UI.

  const webDistPath = resolve(import.meta.dirname, "../../web/dist");
  const hasWebDist = existsSync(webDistPath);

  if (hasWebDist) {
    // Compute root relative to CWD so serveStatic works regardless of where the server is launched
    const relativeRoot = "./" + relative(process.cwd(), webDistPath).replace(/\\/g, "/");

    // Serve static assets
    app.use("/*", serveStatic({ root: relativeRoot }));

    // SPA fallback: any non-API, non-asset route serves index.html
    app.get("*", serveStatic({ root: relativeRoot, path: "index.html" }));

    console.log(`  → UI:    Serving built frontend from ${webDistPath}`);
  }

  // ── Start server ─────────────────────────────────────────

  const server = serve(
    {
      fetch: app.fetch,
      port: config.port,
      hostname: config.host,
    },
    () => {
      console.log("");
      console.log("  ╔══════════════════════════════════════╗");
      console.log("  ║           VISOR DAEMON               ║");
      console.log("  ╚══════════════════════════════════════╝");
      console.log("");
      console.log(`  → HTTP:  http://${config.host}:${config.port}`);
      console.log(`  → WS:    ws://${config.host}:${config.port}/ws`);
      console.log(`  → API:   http://${config.host}:${config.port}/api`);
      if (!hasWebDist) {
        console.log(`  → UI:    Not found. Run "npm run build:web" first.`);
      }
      console.log("");
    }
  );

  injectWebSocket(server);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
