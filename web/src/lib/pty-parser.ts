/**
 * PTY Output Parser v2
 *
 * Instead of trying to parse the raw ANSI stream (which fails for TUI apps),
 * we accumulate chunks and extract readable text by:
 * 1. Stripping all ANSI escape sequences
 * 2. Stripping control characters
 * 3. Collapsing decorative unicode (box drawing, blocks, geometric shapes)
 * 4. Deduplicating repeated content (TUI redraws)
 * 5. Only emitting lines that contain meaningful text
 */

// ANSI escape sequences (CSI, OSC, DCS, etc.)
const ANSI_RE = /\x1b(?:\[[0-9;?]*[a-zA-Z]|\][^\x07\x1b]*(?:\x07|\x1b\\)|\([0-9A-B]|[>=<78HMDEFNG]|\[[\d;]*[Hf]|.)/g;

// Control chars except \n
const CTRL_RE = /[\x00-\x09\x0b-\x1f\x7f]/g;

// Unicode block elements, box drawing, geometric shapes, braille patterns
const DECORATIVE_RE = /[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2800-\u28FF\u2B1B\u2B1C\u2B50\u2B55\u29BE\u29BF\u2022\u25CF\u25CB\u25A0\u25A1\u25B2\u25B3\u25BC\u25BD\u25C0\u25C1\u25C6\u25C7\u25BA\u25BB\u2502\u2503\u250A\u250B\u2523\u252B\u254B\u2501\u2517\u251B\u2513\u250F\u253B\u2533\u2573]+/g;

// Lines that are only whitespace/decorative after cleaning
const EMPTY_LINE_RE = /^\s*$/;

// Minimum meaningful text length
const MIN_LINE_LENGTH = 2;

function cleanText(raw: string): string {
  return raw
    .replace(ANSI_RE, "")
    .replace(CTRL_RE, "")
    .replace(DECORATIVE_RE, " ")
    .replace(/\s{3,}/g, "  ")  // Collapse runs of whitespace
    .trim();
}

/**
 * Smart output accumulator that deduplicates TUI redraws
 * and only emits meaningful new text.
 */
export class OutputAccumulator {
  private seenLines = new Set<string>();
  private lastEmitted = "";
  private buffer = "";

  /**
   * Push raw PTY data. Returns array of new meaningful lines.
   */
  push(raw: string): string[] {
    this.buffer += raw;

    // Split on newlines
    const parts = this.buffer.split("\n");
    // Keep last incomplete part in buffer
    this.buffer = parts.pop() || "";

    const results: string[] = [];

    for (const part of parts) {
      const clean = cleanText(part);

      // Skip empty, too short, or already-seen lines
      if (EMPTY_LINE_RE.test(clean)) continue;
      if (clean.length < MIN_LINE_LENGTH) continue;
      if (this.seenLines.has(clean)) continue;
      // Skip if this line is a substring of the last emitted (partial redraw)
      if (this.lastEmitted.includes(clean)) continue;
      // Skip if last emitted is a substring of this (extending — replace)
      if (clean.includes(this.lastEmitted) && this.lastEmitted.length > 10) {
        // This is an extension of the previous line, replace it
        this.seenLines.delete(this.lastEmitted);
        if (results.length > 0) {
          results[results.length - 1] = clean;
        } else {
          results.push(clean);
        }
        this.seenLines.add(clean);
        this.lastEmitted = clean;
        continue;
      }

      this.seenLines.add(clean);
      this.lastEmitted = clean;
      results.push(clean);

      // Keep the set from growing unbounded
      if (this.seenLines.size > 500) {
        const arr = Array.from(this.seenLines);
        this.seenLines = new Set(arr.slice(-300));
      }
    }

    return results;
  }

  /**
   * Flush remaining buffer.
   */
  flush(): string | null {
    if (this.buffer.length > 0) {
      const clean = cleanText(this.buffer);
      this.buffer = "";
      if (clean.length >= MIN_LINE_LENGTH && !this.seenLines.has(clean)) {
        this.seenLines.add(clean);
        this.lastEmitted = clean;
        return clean;
      }
    }
    return null;
  }

  clear(): void {
    this.seenLines.clear();
    this.buffer = "";
    this.lastEmitted = "";
  }
}
