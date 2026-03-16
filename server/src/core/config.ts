import { randomBytes } from "node:crypto";
import { join, resolve, isAbsolute } from "node:path";
import type { VisorConfig } from "./types.ts";

/**
 * Absolute path to the project root directory.
 * Resolved from this file's location (server/src/core/) up three levels.
 * This allows the server to find data/ and web/dist/ regardless of process.cwd().
 */
export const PROJECT_ROOT = resolve(import.meta.dirname, "../../..");

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function resolveDbPath(): string {
  const envPath = process.env.VISOR_DB_PATH;
  if (!envPath) return join(PROJECT_ROOT, "data", "visor.db");
  // If the env var is an absolute path, use it as-is; otherwise resolve relative to PROJECT_ROOT
  return isAbsolute(envPath) ? envPath : resolve(PROJECT_ROOT, envPath);
}

export function loadConfig(): VisorConfig {
  const config: VisorConfig = {
    port: parseInt(process.env.VISOR_PORT || "3100", 10),
    host: process.env.VISOR_HOST || "0.0.0.0",
    authToken: process.env.VISOR_TOKEN || generateToken(),
    dbPath: resolveDbPath(),
    defaultShell: process.env.VISOR_SHELL || (process.platform === "win32" ? "powershell.exe" : "/bin/bash"),
    corsOrigin: process.env.VISOR_CORS_ORIGIN || "*",
  };

  if (!process.env.VISOR_TOKEN) {
    console.log("─────────────────────────────────────────────");
    console.log("  No VISOR_TOKEN set. Generated one-time token:");
    console.log(`  ${config.authToken}`);
    console.log("  Set VISOR_TOKEN env var to persist it.");
    console.log("─────────────────────────────────────────────");
  }

  return config;
}
