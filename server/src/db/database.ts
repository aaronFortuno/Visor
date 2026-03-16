import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import type { Session, SessionEvent, CreateSessionOpts, EventKind } from "../core/types.ts";

let db: SqlJsDatabase;
let dbPath: string;

// Auto-save interval
let saveTimer: ReturnType<typeof setInterval> | null = null;

export async function initDatabase(path: string): Promise<SqlJsDatabase> {
  dbPath = path;
  mkdirSync(dirname(path), { recursive: true });

  const SQL = await initSqlJs();

  if (existsSync(path)) {
    const buffer = readFileSync(path);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'stopped',
      command TEXT NOT NULL,
      args TEXT NOT NULL DEFAULT '[]',
      cwd TEXT NOT NULL,
      pid INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events(session_id, timestamp)");

  // Persist to disk every 5 seconds (catches event data)
  saveTimer = setInterval(() => saveDatabase(), 5000);

  // NOTE: Do NOT save on process.on("exit") — on Windows with kill,
  // the db may already be in an inconsistent state and would overwrite
  // the good save from execute(). Session data is saved immediately
  // in execute() after every session write.

  return db;
}

export function saveDatabase(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error("  [db] Save error:", err);
  }
}

// ── Helper to run queries ──────────────────────────────────

function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);

  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql: string, params: any[] = []): any | null {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function execute(sql: string, params: any[] = []): void {
  db.run(sql, params);
  // Persist immediately — critical for session data surviving crashes
  saveDatabase();
}

// ── Session queries ────────────────────────────────────────

function rowToSession(row: any): Session {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    command: row.command,
    args: JSON.parse(row.args),
    cwd: row.cwd,
    pid: row.pid,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertSession(id: string, opts: CreateSessionOpts): Session {
  execute(
    "INSERT INTO sessions (id, name, type, command, args, cwd) VALUES (?, ?, ?, ?, ?, ?)",
    [id, opts.name, opts.type, opts.command, JSON.stringify(opts.args || []), opts.cwd || homedir()]
  );
  return getSessionById(id)!;
}

export function getSessionById(id: string): Session | null {
  const row = queryOne("SELECT * FROM sessions WHERE id = ?", [id]);
  return row ? rowToSession(row) : null;
}

export function getAllSessions(): Session[] {
  const rows = queryAll("SELECT * FROM sessions ORDER BY created_at DESC");
  return rows.map(rowToSession);
}

export function updateSession(id: string, updates: Partial<Pick<Session, "status" | "pid" | "name">>): Session | null {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.pid !== undefined) {
    fields.push("pid = ?");
    values.push(updates.pid);
  }
  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }

  if (fields.length === 0) return getSessionById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  execute(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`, values);
  return getSessionById(id);
}

export function deleteSession(id: string): boolean {
  const before = queryOne("SELECT COUNT(*) as count FROM sessions WHERE id = ?", [id]);
  if (!before || before.count === 0) return false;
  execute("DELETE FROM events WHERE session_id = ?", [id]);
  execute("DELETE FROM sessions WHERE id = ?", [id]);
  return true;
}

// ── Event queries ──────────────────────────────────────────

const MAX_EVENTS_PER_SESSION = 5000;
let pruneCounter = 0;

export function insertEvent(sessionId: string, kind: EventKind, data: string): void {
  // Don't save on every event — the interval handles persistence
  db.run(
    "INSERT INTO events (session_id, kind, data) VALUES (?, ?, ?)",
    [sessionId, kind, data]
  );

  // Prune old events periodically (every ~100 inserts) to prevent unbounded growth
  pruneCounter++;
  if (pruneCounter >= 100) {
    pruneCounter = 0;
    pruneEvents(sessionId, MAX_EVENTS_PER_SESSION);
  }
}

function pruneEvents(sessionId: string, maxEvents: number): void {
  try {
    const row = queryOne("SELECT COUNT(*) as count FROM events WHERE session_id = ?", [sessionId]);
    if (row && row.count > maxEvents) {
      const excess = row.count - maxEvents;
      db.run(
        "DELETE FROM events WHERE id IN (SELECT id FROM events WHERE session_id = ? ORDER BY id ASC LIMIT ?)",
        [sessionId, excess]
      );
    }
  } catch { /* ignore pruning errors */ }
}

export function getEvents(sessionId: string, opts?: { limit?: number; after?: number }): SessionEvent[] {
  const limit = opts?.limit ?? 200;
  const after = opts?.after ?? 0;

  const rows = queryAll(
    "SELECT * FROM events WHERE session_id = ? AND id > ? ORDER BY id ASC LIMIT ?",
    [sessionId, after, limit]
  );

  return rows.map((row: any) => ({
    id: row.id,
    sessionId: row.session_id,
    kind: row.kind,
    data: row.data,
    timestamp: row.timestamp,
  }));
}

export function getEventCount(sessionId: string): number {
  const row = queryOne("SELECT COUNT(*) as count FROM events WHERE session_id = ?", [sessionId]);
  return row?.count ?? 0;
}
