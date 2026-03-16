#!/usr/bin/env node --experimental-strip-types
/**
 * Visor CLI — Remote agent session manager.
 *
 * Usage:
 *   visor                              Interactive: list sessions, pick one
 *   visor ls                           List all sessions
 *   visor open [path] [--agent type]   Launch agent in a project folder
 *   visor attach <id>                  Attach to a running session
 *   visor new <type> [name] [--cwd p]  Create a session (low-level)
 *   visor stop <id>                    Stop a session
 *   visor rm <id>                      Delete a session
 *   visor send <id> <msg>              Send input to a session
 *   visor health                       Server status
 *
 * Config is auto-loaded from .env in the visor project root.
 * Override with VISOR_URL and VISOR_TOKEN env vars.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import * as readline from "node:readline";
import WebSocket from "ws";

// ── Auto-load .env from visor project root ─────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const envPath = resolve(projectRoot, ".env");

if (existsSync(envPath)) {
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([^#\s][^=]*)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore .env read errors
  }
}

// ── Config ─────────────────────────────────────────────────

const VISOR_URL = process.env.VISOR_URL || "http://localhost:3100";
const VISOR_TOKEN = process.env.VISOR_TOKEN || "";

if (!VISOR_TOKEN) {
  console.error("Error: No VISOR_TOKEN found.");
  console.error(`Checked: ${envPath}`);
  console.error("Set VISOR_TOKEN in .env or as environment variable.");
  process.exit(1);
}

function apiUrl(path: string): string {
  return `${VISOR_URL}/api${path}`;
}

function wsUrl(): string {
  const base = VISOR_URL.replace(/^http/, "ws");
  return `${base}/ws?token=${VISOR_TOKEN}`;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${VISOR_TOKEN}`,
  };
}

// ── API helpers ────────────────────────────────────────────

async function api(method: string, path: string, body?: object): Promise<any> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Commands ───────────────────────────────────────────────

async function cmdHealth() {
  const data = await api("GET", "/health");
  console.log(`Status:   ${data.status}`);
  console.log(`Uptime:   ${Math.floor(data.uptime)}s`);
  console.log(`Sessions: ${data.sessions}`);
}

async function cmdList() {
  const { sessions } = await api("GET", "/sessions");

  if (sessions.length === 0) {
    console.log("No sessions.");
    console.log("  Launch one with:  visor open C:\\path\\to\\project");
    return sessions;
  }

  const STATUS_ICON: Record<string, string> = {
    running: "\x1b[32m●\x1b[0m",
    stopped: "\x1b[90m○\x1b[0m",
    error: "\x1b[31m✖\x1b[0m",
    paused: "\x1b[33m◉\x1b[0m",
  };

  console.log("");
  console.log("  #  ID            Status     Type          Name");
  console.log("  ─────────────────────────────────────────────────────────");

  sessions.forEach((s: any, i: number) => {
    const icon = STATUS_ICON[s.status] || "?";
    const num = String(i + 1).padStart(2);
    const id = s.id.padEnd(12);
    const status = s.status.padEnd(8);
    const type = s.type.padEnd(12);
    console.log(`  ${num} ${icon} ${id} ${status} ${type} ${s.name}`);
  });

  console.log("");
  return sessions;
}

/**
 * visor open [path] [--agent claude-code|opencode]
 * Opens an agent session in a project folder.
 * Defaults to current directory and opencode.
 */
async function cmdOpen(targetPath?: string, agentType?: string) {
  const cwd = resolve(targetPath || ".");
  const agent = agentType || "opencode";
  const name = basename(cwd);

  if (!existsSync(cwd)) {
    throw new Error(`Directory not found: ${cwd}`);
  }

  const PRESETS: Record<string, { command: string; type: string }> = {
    "claude-code": { command: "claude", type: "claude-code" },
    claude: { command: "claude", type: "claude-code" },
    opencode: { command: "opencode", type: "opencode" },
    oc: { command: "opencode", type: "opencode" },
    shell: { command: process.platform === "win32" ? "powershell.exe" : "/bin/bash", type: "custom" },
  };

  const preset = PRESETS[agent];
  if (!preset) {
    throw new Error(`Unknown agent: ${agent}. Options: claude-code, opencode, shell`);
  }

  console.log(`Launching ${agent} in ${cwd}...`);

  const data = await api("POST", "/sessions", {
    name: `${name} (${agent})`,
    type: preset.type,
    command: preset.command,
    args: [],
    cwd,
    autoStart: true,
  });

  const session = data.session;
  console.log(`Session ${session.id} created.`);
  console.log("");

  // Auto-attach
  await cmdAttach(session.id);
}

async function cmdNew(type: string, name?: string, cwd?: string) {
  const PRESETS: Record<string, { command: string; args: string[] }> = {
    "claude-code": { command: "claude", args: [] },
    opencode: { command: "opencode", args: [] },
    shell: { command: process.platform === "win32" ? "powershell.exe" : "/bin/bash", args: [] },
  };

  const preset = PRESETS[type];
  const sessionType = type === "shell" ? "custom" : type;

  const data = await api("POST", "/sessions", {
    name: name || type,
    type: sessionType,
    command: preset?.command || type,
    args: preset?.args || [],
    cwd: cwd || undefined,
    autoStart: true,
  });

  console.log(`Session created: ${data.session.id} (${data.session.name})`);
  console.log(`Attach with: visor attach ${data.session.id}`);
}

async function cmdStop(id: string) {
  const resolved = await resolveSessionId(id);
  const data = await api("POST", `/sessions/${resolved}/stop`);
  console.log(`Session ${data.session.id} stopped.`);
}

async function cmdRemove(id: string) {
  const resolved = await resolveSessionId(id);
  await api("DELETE", `/sessions/${resolved}`);
  console.log(`Session ${resolved} deleted.`);
}

async function cmdSend(id: string, message: string) {
  const resolved = await resolveSessionId(id);
  await api("POST", `/sessions/${resolved}/input`, { data: message + "\r" });
  console.log(`Sent to ${resolved}.`);
}

async function cmdAttach(id: string) {
  const resolved = await resolveSessionId(id);
  const { session } = await api("GET", `/sessions/${resolved}`);
  console.log(`Attaching to "\x1b[1m${session.name}\x1b[0m" (${session.type}, ${session.status})`);
  console.log("Ctrl+] to detach.\n");

  const ws = new WebSocket(wsUrl());

  return new Promise<void>((resolve, reject) => {
    ws.on("open", () => {
      // Subscribe in raw mode (CLI gets raw PTY output)
      ws.send(JSON.stringify({ type: "subscribe", sessionId: session.id, mode: "raw" }));

      const cols = process.stdout.columns || 80;
      const rows = process.stdout.rows || 24;

      // Resize PTY to match this terminal
      ws.send(JSON.stringify({ type: "resize", sessionId: session.id, cols, rows }));

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      // Track terminal resize and forward to PTY
      process.stdout.on("resize", () => {
        const newCols = process.stdout.columns || 80;
        const newRows = process.stdout.rows || 24;
        ws.send(JSON.stringify({ type: "resize", sessionId: session.id, cols: newCols, rows: newRows }));
      });

      process.stdin.on("data", (data: Buffer) => {
        const str = data.toString();

        // Ctrl+] = detach
        if (str === "\x1d") {
          console.log("\nDetached.");
          ws.close();
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          resolve();
          return;
        }

        ws.send(JSON.stringify({ type: "input", sessionId: session.id, data: str }));
      });
    });

    // Skip old history output — only show live output after resize kicks in
    let acceptOutput = false;
    setTimeout(() => { acceptOutput = true; }, 300);

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "output" && msg.sessionId === session.id) {
          if ((msg.kind === "stdout" || msg.kind === "stderr") && acceptOutput) {
            process.stdout.write(msg.data);
          }
        }

        if (msg.type === "session:update" && msg.session.id === session.id) {
          if (msg.session.status === "stopped" || msg.session.status === "error") {
            console.log(`\nSession ${msg.session.status}.`);
            ws.close();
            if (process.stdin.isTTY) {
              process.stdin.setRawMode(false);
            }
            resolve();
          }
        }

        if (msg.type === "question" && msg.sessionId === session.id) {
          process.stdout.write("\x07"); // Bell
        }
      } catch {
        // Ignore parse errors
      }
    });

    ws.on("close", () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      resolve();
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err.message);
      reject(err);
    });
  });
}

/**
 * Resolve a session ID from partial input.
 * Accepts: full ID, partial ID prefix, or index number (1-based).
 */
async function resolveSessionId(input: string): Promise<string> {
  const { sessions } = await api("GET", "/sessions");

  // Try as 1-based index number
  const num = parseInt(input);
  if (!isNaN(num) && num >= 1 && num <= sessions.length) {
    return sessions[num - 1].id;
  }

  // Try exact match
  const exact = sessions.find((s: any) => s.id === input);
  if (exact) return exact.id;

  // Try prefix match
  const prefix = sessions.filter((s: any) => s.id.startsWith(input));
  if (prefix.length === 1) return prefix[0].id;
  if (prefix.length > 1) {
    throw new Error(`Ambiguous ID "${input}". Matches: ${prefix.map((s: any) => s.id).join(", ")}`);
  }

  // Try name match
  const byName = sessions.filter((s: any) =>
    s.name.toLowerCase().includes(input.toLowerCase())
  );
  if (byName.length === 1) return byName[0].id;

  throw new Error(`Session not found: ${input}`);
}

async function cmdInteractive() {
  const sessions = await cmdList();
  const hasSessions = sessions && sessions.length > 0;

  console.log("  \x1b[33m0\x1b[0m  New session...");
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = hasSessions
    ? "  Enter # to attach, 0 for new (q to quit): "
    : "  Press 0 for new session (q to quit): ";

  rl.question(prompt, async (answer) => {
    rl.close();

    const trimmed = answer.trim();
    if (trimmed === "q" || trimmed === "") return;

    if (trimmed === "0") {
      await cmdInteractiveNew();
      return;
    }

    try {
      const resolved = await resolveSessionId(trimmed);
      await cmdAttach(resolved);
    } catch (err: any) {
      console.error(err.message);
    }
  });
}

async function cmdInteractiveNew() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("");
  console.log("  \x1b[33mNew session\x1b[0m");
  console.log("  ─────────────────────────────────────────");
  console.log("  1  opencode");
  console.log("  2  claude-code");
  console.log("  3  shell");
  console.log("");

  const agentAnswer = await new Promise<string>((res) => {
    rl.question("  Agent type (1/2/3): ", res);
  });

  const AGENTS: Record<string, string> = { "1": "opencode", "2": "claude-code", "3": "shell" };
  const agent = AGENTS[agentAnswer.trim()] || AGENTS["1"];

  const cwdAnswer = await new Promise<string>((res) => {
    rl.question(`  Working directory [${process.cwd()}]: `, res);
  });

  rl.close();

  const cwd = cwdAnswer.trim() || process.cwd();

  await cmdOpen(cwd, agent);
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "health":
        await cmdHealth();
        break;

      case "list":
      case "ls":
        await cmdList();
        break;

      case "open":
      case "o": {
        // visor open [path] [--agent type]
        let path: string | undefined;
        let agent: string | undefined;
        for (let i = 1; i < args.length; i++) {
          if (args[i] === "--agent" || args[i] === "-a") {
            agent = args[++i];
          } else if (!path) {
            path = args[i];
          }
        }
        await cmdOpen(path, agent);
        break;
      }

      case "new":
      case "create": {
        if (!args[1]) {
          console.error("Usage: visor new <type> [name] [--cwd path]");
          console.error("Types: claude-code, opencode, shell");
          process.exit(1);
        }
        let cwd: string | undefined;
        let name: string | undefined;
        for (let i = 2; i < args.length; i++) {
          if (args[i] === "--cwd") cwd = args[++i];
          else if (!name) name = args[i];
        }
        await cmdNew(args[1], name, cwd);
        break;
      }

      case "attach":
      case "a":
        if (!args[1]) {
          console.error("Usage: visor attach <id | # | name>");
          process.exit(1);
        }
        await cmdAttach(args[1]);
        break;

      case "stop":
        if (!args[1]) { console.error("Usage: visor stop <id>"); process.exit(1); }
        await cmdStop(args[1]);
        break;

      case "rm":
      case "remove":
      case "delete":
        if (!args[1]) { console.error("Usage: visor rm <id>"); process.exit(1); }
        await cmdRemove(args[1]);
        break;

      case "send":
      case "s":
        if (!args[1] || !args[2]) {
          console.error('Usage: visor send <id> "message"');
          process.exit(1);
        }
        await cmdSend(args[1], args.slice(2).join(" "));
        break;

      case "help":
      case "--help":
      case "-h":
        printHelp();
        break;

      default:
        await cmdInteractive();
        break;
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
  \x1b[1mVisor CLI\x1b[0m — Remote agent session manager

  \x1b[33mUsage:\x1b[0m
    visor                              Interactive mode (list + pick)
    visor open [path] [-a agent]       Launch agent in project dir
    visor ls                           List sessions
    visor attach <id|#|name>           Attach to session
    visor send <id> "message"          Send input without attaching
    visor stop <id>                    Stop a session
    visor rm <id>                      Delete a session
    visor health                       Server status

  \x1b[33mExamples:\x1b[0m
    visor open C:\\Projects\\my-app              # opencode in my-app
    visor open . --agent claude-code            # claude in current dir
    visor attach 1                              # attach to session #1
    visor send 1 "yes"                          # answer "yes" to session #1

  \x1b[33mAgents:\x1b[0m  opencode (default), claude-code, shell

  \x1b[33mConfig:\x1b[0m  Auto-loaded from ${envPath}
  \x1b[33mDetach:\x1b[0m  Ctrl+]
`);
}

main();
