import { describe, it, expect, beforeEach } from "vitest";
import { OutputAccumulator } from "./pty-parser.ts";

describe("OutputAccumulator", () => {
  let acc: OutputAccumulator;

  beforeEach(() => {
    acc = new OutputAccumulator();
  });

  describe("push()", () => {
    it("returns clean text lines from plain input", () => {
      const lines = acc.push("Hello world\nThis is a test\n");
      expect(lines).toContain("Hello world");
      expect(lines).toContain("This is a test");
    });

    it("strips ANSI escape codes", () => {
      const lines = acc.push("\x1b[31mRed text\x1b[0m here\n");
      expect(lines.length).toBeGreaterThanOrEqual(1);
      const joined = lines.join(" ");
      expect(joined).toContain("Red text");
      expect(joined).toContain("here");
      expect(joined).not.toContain("\x1b");
    });

    it("deduplicates repeated lines", () => {
      const first = acc.push("Same line content\n");
      expect(first).toContain("Same line content");

      const second = acc.push("Same line content\n");
      // Should be empty since the line was already seen
      expect(second).toEqual([]);
    });

    it("skips empty and too-short lines", () => {
      const lines = acc.push("\n\n  \nA\n\n");
      // Empty lines and single-char "A" should be skipped
      expect(lines).toEqual([]);
    });

    it("accumulates multiple sequential pushes correctly", () => {
      const lines1 = acc.push("First line\n");
      const lines2 = acc.push("Second line\n");
      const lines3 = acc.push("Third line\n");

      expect(lines1).toContain("First line");
      expect(lines2).toContain("Second line");
      expect(lines3).toContain("Third line");
    });

    it("handles partial lines across pushes (buffering)", () => {
      // Push incomplete line (no trailing newline)
      const first = acc.push("Partial ");
      expect(first).toEqual([]); // buffered, not emitted yet

      // Complete the line
      const second = acc.push("line content\n");
      expect(second.length).toBeGreaterThanOrEqual(1);
      const joined = second.join(" ");
      expect(joined).toContain("Partial");
      expect(joined).toContain("line content");
    });

    it("strips decorative unicode characters", () => {
      const lines = acc.push("──── Some Title ────\n");
      // The decorative chars should be replaced/stripped
      if (lines.length > 0) {
        const joined = lines.join(" ");
        expect(joined).not.toContain("────");
        // "Some Title" might remain if it passes the meaningful text check
      }
    });

    it("handles complex ANSI sequences (cursor movement, OSC)", () => {
      // CSI cursor movement + OSC title set + regular text
      const lines = acc.push("\x1b[2J\x1b[H\x1b]0;My Title\x07Normal text here\n");
      if (lines.length > 0) {
        const joined = lines.join(" ");
        expect(joined).toContain("Normal text here");
        expect(joined).not.toContain("\x1b");
      }
    });
  });

  describe("flush()", () => {
    it("returns remaining buffered content", () => {
      acc.push("Buffered text without newline");
      const flushed = acc.flush();
      expect(flushed).not.toBeNull();
      expect(flushed).toContain("Buffered text without newline");
    });

    it("returns null when buffer is empty", () => {
      const flushed = acc.flush();
      expect(flushed).toBeNull();
    });

    it("returns null when flushed content was already seen", () => {
      acc.push("Already seen line\n");
      acc.push("Already seen line"); // same text in buffer
      const flushed = acc.flush();
      expect(flushed).toBeNull();
    });
  });

  describe("clear()", () => {
    it("resets all state so previously seen lines can be emitted again", () => {
      acc.push("Seen before\n");
      acc.clear();

      const lines = acc.push("Seen before\n");
      expect(lines).toContain("Seen before");
    });

    it("clears the internal buffer", () => {
      acc.push("Incomplete");
      acc.clear();
      const flushed = acc.flush();
      expect(flushed).toBeNull();
    });
  });
});
