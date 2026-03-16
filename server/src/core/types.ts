export * from "@visor/shared";

// ── Config (server-only) ──────────────────────────────────

export interface VisorConfig {
  port: number;
  host: string;
  authToken: string;
  dbPath: string;
  defaultShell: string;
}
