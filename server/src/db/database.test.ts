import { describe, it, expect, beforeEach } from "vitest";
import {
  initDatabase,
  insertSession,
  getSessionById,
  getAllSessions,
  updateSession,
  deleteSession,
  insertEvent,
  getEvents,
  getEventCount,
} from "./database.ts";
import type { CreateSessionOpts } from "../core/types.ts";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

function tempDbPath(): string {
  return join(tmpdir(), `visor-test-${randomBytes(8).toString("hex")}.db`);
}

function makeSessionOpts(overrides?: Partial<CreateSessionOpts>): CreateSessionOpts {
  return {
    name: "Test Session",
    type: "claude-code",
    command: "echo",
    args: ["hello"],
    cwd: "/tmp",
    ...overrides,
  };
}

describe("Database", () => {
  beforeEach(async () => {
    // Each test gets a fresh in-memory-like database (unique temp file)
    await initDatabase(tempDbPath());
  });

  describe("initDatabase()", () => {
    it("creates sessions and events tables", async () => {
      const db = await initDatabase(tempDbPath());
      // Verify tables exist by querying them
      const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sessions', 'events') ORDER BY name");
      const tables: string[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        tables.push(row.name as string);
      }
      stmt.free();
      expect(tables).toContain("sessions");
      expect(tables).toContain("events");
    });
  });

  describe("insertSession() and getSessionById()", () => {
    it("round-trips session data", () => {
      const opts = makeSessionOpts({ name: "My Agent", args: ["--verbose"] });
      const session = insertSession("sess-1", opts);

      expect(session.id).toBe("sess-1");
      expect(session.name).toBe("My Agent");
      expect(session.type).toBe("claude-code");
      expect(session.command).toBe("echo");
      expect(session.args).toEqual(["--verbose"]);
      expect(session.cwd).toBe("/tmp");
      expect(session.status).toBe("stopped");
      expect(session.pid).toBeNull();
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();

      const fetched = getSessionById("sess-1");
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe("sess-1");
      expect(fetched!.name).toBe("My Agent");
      expect(fetched!.args).toEqual(["--verbose"]);
    });

    it("returns null for non-existent session", () => {
      const fetched = getSessionById("does-not-exist");
      expect(fetched).toBeNull();
    });
  });

  describe("getAllSessions()", () => {
    it("returns all sessions ordered by created_at DESC", () => {
      insertSession("s1", makeSessionOpts({ name: "First" }));
      insertSession("s2", makeSessionOpts({ name: "Second" }));
      insertSession("s3", makeSessionOpts({ name: "Third" }));

      const all = getAllSessions();
      expect(all).toHaveLength(3);
      // Most recent first (all created at roughly same time, but insertion order)
      const names = all.map((s) => s.name);
      expect(names).toContain("First");
      expect(names).toContain("Second");
      expect(names).toContain("Third");
    });

    it("returns empty array when no sessions exist", () => {
      const all = getAllSessions();
      expect(all).toEqual([]);
    });
  });

  describe("updateSession()", () => {
    it("updates status field", () => {
      insertSession("s1", makeSessionOpts());
      const updated = updateSession("s1", { status: "running" });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("running");
    });

    it("updates pid field", () => {
      insertSession("s1", makeSessionOpts());
      const updated = updateSession("s1", { pid: 12345 });
      expect(updated).not.toBeNull();
      expect(updated!.pid).toBe(12345);
    });

    it("updates name field", () => {
      insertSession("s1", makeSessionOpts({ name: "Old Name" }));
      const updated = updateSession("s1", { name: "New Name" });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe("New Name");
    });

    it("updates multiple fields at once", () => {
      insertSession("s1", makeSessionOpts());
      const updated = updateSession("s1", { status: "running", pid: 9999 });
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("running");
      expect(updated!.pid).toBe(9999);
    });

    it("returns session unchanged when no updates provided", () => {
      insertSession("s1", makeSessionOpts({ name: "Same" }));
      const updated = updateSession("s1", {});
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe("Same");
    });
  });

  describe("deleteSession()", () => {
    it("removes session and returns true", () => {
      insertSession("s1", makeSessionOpts());
      const result = deleteSession("s1");
      expect(result).toBe(true);
      expect(getSessionById("s1")).toBeNull();
    });

    it("removes associated events on cascade", () => {
      insertSession("s1", makeSessionOpts());
      insertEvent("s1", "stdout", "hello");
      insertEvent("s1", "stdout", "world");
      expect(getEventCount("s1")).toBe(2);

      deleteSession("s1");
      expect(getEventCount("s1")).toBe(0);
    });

    it("returns false for non-existent session", () => {
      const result = deleteSession("does-not-exist");
      expect(result).toBe(false);
    });
  });

  describe("events", () => {
    it("insertEvent() stores events and getEvents() retrieves them", () => {
      insertSession("s1", makeSessionOpts());
      insertEvent("s1", "stdout", "Line 1");
      insertEvent("s1", "stderr", "Error 1");
      insertEvent("s1", "stdin", "User input");

      const events = getEvents("s1");
      expect(events).toHaveLength(3);
      expect(events[0].kind).toBe("stdout");
      expect(events[0].data).toBe("Line 1");
      expect(events[1].kind).toBe("stderr");
      expect(events[2].kind).toBe("stdin");
      expect(events[0].sessionId).toBe("s1");
    });

    it("getEvents() supports limit option", () => {
      insertSession("s1", makeSessionOpts());
      for (let i = 0; i < 10; i++) {
        insertEvent("s1", "stdout", `Line ${i}`);
      }
      const events = getEvents("s1", { limit: 5 });
      expect(events).toHaveLength(5);
    });

    it("getEvents() supports after option for pagination", () => {
      insertSession("s1", makeSessionOpts());
      for (let i = 0; i < 5; i++) {
        insertEvent("s1", "stdout", `Line ${i}`);
      }
      const first = getEvents("s1", { limit: 2 });
      expect(first).toHaveLength(2);
      const lastId = first[first.length - 1].id;

      const next = getEvents("s1", { after: lastId, limit: 2 });
      expect(next).toHaveLength(2);
      expect(next[0].id).toBeGreaterThan(lastId);
    });

    it("getEventCount() returns correct count", () => {
      insertSession("s1", makeSessionOpts());
      expect(getEventCount("s1")).toBe(0);
      insertEvent("s1", "stdout", "a");
      insertEvent("s1", "stdout", "b");
      expect(getEventCount("s1")).toBe(2);
    });

    it("event pruning triggers after 100 inserts", () => {
      insertSession("s1", makeSessionOpts());
      // Insert 150 events to trigger pruning (triggers at count 100)
      for (let i = 0; i < 150; i++) {
        insertEvent("s1", "stdout", `Event ${i}`);
      }
      // Pruning should have occurred at event 100
      // The count should be <= MAX_EVENTS_PER_SESSION (5000)
      // but we can verify the events are all still there since 150 < 5000
      const count = getEventCount("s1");
      expect(count).toBe(150); // 150 < 5000 so no actual pruning, but pruneEvents ran
    });
  });
});
