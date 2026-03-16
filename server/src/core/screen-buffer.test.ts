import { describe, it, expect, beforeEach } from "vitest";
import { ScreenBuffer } from "./screen-buffer.ts";

describe("ScreenBuffer", () => {
  let buf: ScreenBuffer;

  beforeEach(() => {
    buf = new ScreenBuffer(80, 24);
  });

  describe("write() and extractNewContent()", () => {
    it("returns plain text after write", () => {
      buf.write("Hello, world!");
      const content = buf.extractNewContent();
      expect(content).not.toBeNull();
      expect(content).toContain("Hello, world!");
    });

    it("strips ANSI color codes from output", () => {
      // Write text with ANSI color escape: red "Error" then reset
      buf.write("\x1b[31mError\x1b[0m occurred");
      const content = buf.extractNewContent();
      expect(content).not.toBeNull();
      expect(content).toContain("Error");
      expect(content).toContain("occurred");
      // Should not contain raw escape sequences
      expect(content).not.toContain("\x1b");
    });

    it("deduplicates content — second call returns null if unchanged", () => {
      buf.write("Same content line");
      const first = buf.extractNewContent();
      expect(first).not.toBeNull();
      expect(first).toContain("Same content line");

      // Second call with no new writes — grid unchanged
      const second = buf.extractNewContent();
      expect(second).toBeNull();
    });

    it("returns null when nothing has been written", () => {
      // Freshly constructed buffer — all spaces, no meaningful content
      const content = buf.extractNewContent();
      expect(content).toBeNull();
    });

    it("accumulates multiple writes", () => {
      buf.write("Line one\n");
      buf.write("Line two\n");
      buf.write("Line three");
      const content = buf.extractNewContent();
      expect(content).not.toBeNull();
      expect(content).toContain("Line one");
      expect(content).toContain("Line two");
      expect(content).toContain("Line three");
    });

    it("returns only new lines on subsequent extractions", () => {
      buf.write("First line\n");
      const first = buf.extractNewContent();
      expect(first).toContain("First line");

      buf.write("Second line\n");
      const second = buf.extractNewContent();
      expect(second).not.toBeNull();
      expect(second).toContain("Second line");
      // First line was already sent, should not appear again
      expect(second).not.toContain("First line");
    });
  });

  describe("resize()", () => {
    it("changes buffer dimensions", () => {
      buf.write("Before resize");
      buf.extractNewContent(); // mark as sent

      buf.resize(120, 40);
      // Write new content in resized buffer
      buf.write("After resize");
      const content = buf.extractNewContent();
      expect(content).not.toBeNull();
      expect(content).toContain("After resize");
    });

    it("preserves sentLines across resize — does not clear dedup state", () => {
      // Use cursor-home to ensure text always starts at row 0, col 0
      buf.write("\x1b[H"); // cursor home
      buf.write("Unique test line here\n");
      const first = buf.extractNewContent();
      expect(first).not.toBeNull();
      expect(first).toContain("Unique test line here");

      // Resize — grid is cleared, but sentLines is preserved
      buf.resize(80, 24); // same dimensions to avoid leading-space differences
      buf.write("\x1b[H"); // cursor home again
      buf.write("Unique test line here\n");
      const second = buf.extractNewContent();
      // The line "Unique test line here" should already be in sentLines,
      // so it should be deduplicated
      if (second !== null) {
        expect(second).not.toContain("Unique test line here");
      }
    });
  });

  describe("chrome filtering", () => {
    it("filters TUI border/decoration lines", () => {
      // Pure decoration line (box drawing chars)
      buf.write("───────────────────────\n");
      buf.write("│                     │\n");
      buf.write("└─────────────────────┘\n");
      const content = buf.extractNewContent();
      // All lines are pure chrome, should be filtered
      expect(content).toBeNull();
    });

    it("filters status bar chrome patterns", () => {
      // The chrome patterns use ^ anchors but ScreenBuffer grid lines have
      // leading spaces from cursor position. The isChromeLine function also
      // checks if <25% of chars are non-decorative.
      // "esc interrupt" should match /esc\s+interrupt/i
      // Test with content that starts at column 0 via \r
      buf.write("\x1b[2J\x1b[H"); // clear screen, cursor home
      buf.write("esc interrupt\n");
      buf.write("ctrl+t variants\n");
      const content = buf.extractNewContent();
      // These lines should be filtered as chrome
      if (content !== null) {
        expect(content).not.toMatch(/esc interrupt/i);
        expect(content).not.toMatch(/ctrl\+t variants/i);
      }
    });

    it("keeps real conversation text", () => {
      buf.write("───────────────────────\n");
      buf.write("This is actual conversation text from the agent\n");
      buf.write("───────────────────────\n");
      const content = buf.extractNewContent();
      expect(content).not.toBeNull();
      expect(content).toContain("This is actual conversation text from the agent");
    });
  });

  describe("ANSI cursor movement", () => {
    it("handles carriage return (overwrites line)", () => {
      buf.write("AAAA\rBB");
      const content = buf.extractNewContent();
      expect(content).not.toBeNull();
      // After CR, cursor goes to col 0, "BB" overwrites first 2 chars
      expect(content).toContain("BB");
      expect(content).toContain("AA"); // remaining AA at end
    });

    it("handles newline to advance rows", () => {
      buf.write("Row1\nRow2\nRow3");
      const content = buf.extractNewContent();
      expect(content).not.toBeNull();
      expect(content).toContain("Row1");
      expect(content).toContain("Row2");
      expect(content).toContain("Row3");
    });
  });
});
