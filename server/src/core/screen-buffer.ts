/**
 * ScreenBuffer — Virtual terminal that interprets ANSI escape sequences.
 *
 * Maintains a character grid, interprets cursor movement, clears, etc.
 * Extracts clean conversational text for browser "chat" clients.
 *
 * Key design: `sentLines` persists across resize/clear so we NEVER
 * re-send content the browser already has.
 */

const CSI_FINALS = new Set("ABCDEFGHJKLMPSTXZfhlmnqrsu".split(""));

// Patterns that are TUI chrome, not conversation content
const CHROME_PATTERNS = [
  /^Build\s+·/i,                    // "Build · claude-opus-4-6 · 6.5s"
  /^▣\s+Build/,                     // "▣  Build · ..."
  /esc\s+interrupt/i,               // "esc interrupt"
  /ctrl\+[a-z]\s+\w+/i,            // "ctrl+t variants", "ctrl+p commands"
  /tab\s+agents/i,                  // "tab agents"
  /^\s*\d+\.\d+\s+\d+%\s+\(\$/,    // "11.985  1% ($0.00)"  token counters
  /^tokens:/i,
  /^cost:/i,
  /^\s*·\s*$/,                      // lone separator dots
  /^[\s─━┃│┆┊▀▄█▌▐░▒▓■●○◆▣⬝❯·•]+$/, // pure decoration lines
];

function isChromeLine(line: string): boolean {
  for (const pattern of CHROME_PATTERNS) {
    if (pattern.test(line)) return true;
  }
  // Lines that are mostly non-text characters (>60% decorative)
  const stripped = line.replace(/[─│┌┐└┘├┤┬┴┼━┃┏┓┗┛┣┫┳┻╋▀▄█▌▐░▒▓■●○◆▣⬝❯·•┆┊║╔╗╚╝╠╣╦╩╬→←↑↓\s]/g, "");
  if (stripped.length < line.trim().length * 0.25) return true;
  return false;
}

export class ScreenBuffer {
  private cols: number;
  private rows: number;
  private grid: string[][];
  private cursorRow = 0;
  private cursorCol = 0;

  // Persists across resize — never re-send what we already sent
  private sentLines = new Set<string>();
  private lastEmittedText = "";

  constructor(cols = 80, rows = 24) {
    this.cols = cols;
    this.rows = rows;
    this.grid = this.makeGrid();
  }

  private makeGrid(): string[][] {
    return Array.from({ length: this.rows }, () => new Array(this.cols).fill(" "));
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.grid = this.makeGrid();
    this.cursorRow = Math.min(this.cursorRow, rows - 1);
    this.cursorCol = Math.min(this.cursorCol, cols - 1);
    // NOTE: sentLines is NOT cleared — intentional
  }

  write(data: string): void {
    let i = 0;
    const len = data.length;
    while (i < len) {
      const ch = data[i];
      if (ch === "\x1b") {
        if (i + 1 < len && data[i + 1] === "[") {
          let j = i + 2;
          while (j < len && !CSI_FINALS.has(data[j]) && j - i < 32) j++;
          if (j < len) {
            this.handleCSI(data.substring(i + 2, j), data[j]);
            i = j + 1;
          } else { i = j; }
          continue;
        }
        if (i + 1 < len && data[i + 1] === "]") {
          let j = i + 2;
          while (j < len && data[j] !== "\x07" && !(data[j] === "\x1b" && data[j + 1] === "\\")) j++;
          i = j + (data[j] === "\x07" ? 1 : 2);
          continue;
        }
        i += 2;
        continue;
      }
      if (ch === "\r") { this.cursorCol = 0; i++; continue; }
      if (ch === "\n") {
        this.cursorRow++;
        if (this.cursorRow >= this.rows) { this.scrollUp(); this.cursorRow = this.rows - 1; }
        i++; continue;
      }
      if (ch === "\t") { this.cursorCol = Math.min(this.cursorCol + (8 - (this.cursorCol % 8)), this.cols - 1); i++; continue; }
      if (ch === "\x08") { if (this.cursorCol > 0) this.cursorCol--; i++; continue; }
      if (ch.charCodeAt(0) < 32 || ch === "\x7f") { i++; continue; }
      if (this.cursorCol >= this.cols) {
        this.cursorCol = 0;
        this.cursorRow++;
        if (this.cursorRow >= this.rows) { this.scrollUp(); this.cursorRow = this.rows - 1; }
      }
      this.grid[this.cursorRow][this.cursorCol] = ch;
      this.cursorCol++;
      i++;
    }
  }

  private scrollUp(): void {
    this.grid.shift();
    this.grid.push(new Array(this.cols).fill(" "));
  }

  private handleCSI(params: string, cmd: string): void {
    const nums = params.split(";").map((s) => parseInt(s) || 0);
    const n = nums[0] || 1;
    switch (cmd) {
      case "A": this.cursorRow = Math.max(0, this.cursorRow - n); break;
      case "B": this.cursorRow = Math.min(this.rows - 1, this.cursorRow + n); break;
      case "C": this.cursorCol = Math.min(this.cols - 1, this.cursorCol + n); break;
      case "D": this.cursorCol = Math.max(0, this.cursorCol - n); break;
      case "H": case "f":
        this.cursorRow = Math.max(0, Math.min(this.rows - 1, (nums[0] || 1) - 1));
        this.cursorCol = Math.max(0, Math.min(this.cols - 1, (nums[1] || 1) - 1));
        break;
      case "J":
        if (n === 2 || n === 3) { this.grid = this.makeGrid(); this.cursorRow = 0; this.cursorCol = 0; }
        else if (n === 0) {
          for (let c = this.cursorCol; c < this.cols; c++) this.grid[this.cursorRow][c] = " ";
          for (let r = this.cursorRow + 1; r < this.rows; r++) this.grid[r].fill(" ");
        }
        break;
      case "K":
        if (n === 0 || params === "") { for (let c = this.cursorCol; c < this.cols; c++) this.grid[this.cursorRow][c] = " "; }
        else if (n === 2) { this.grid[this.cursorRow].fill(" "); }
        break;
      case "S": for (let x = 0; x < n; x++) this.scrollUp(); break;
    }
  }

  /**
   * Extract new conversational content since last call.
   * Returns a single string block (multiple lines joined) or null.
   * Lines are filtered for UI chrome and deduplicated against sentLines.
   */
  extractNewContent(): string | null {
    const currentText = this.grid.map((r) => r.join("")).join("\n");
    if (currentText === this.lastEmittedText) return null;
    this.lastEmittedText = currentText;

    // Extract meaningful lines
    const lines = this.grid
      .map((row) => row.join("").trimEnd())
      .filter((l) => l.trim().length > 1)
      .filter((l) => !isChromeLine(l));

    // Find lines not yet sent
    const newLines = lines.filter((line) => !this.sentLines.has(line));
    if (newLines.length === 0) return null;

    // Track sent
    for (const line of newLines) {
      this.sentLines.add(line);
    }
    // Bound the set
    if (this.sentLines.size > 2000) {
      const arr = Array.from(this.sentLines);
      this.sentLines = new Set(arr.slice(-1000));
    }

    // Return as a single block of text
    return newLines.join("\n");
  }
}
