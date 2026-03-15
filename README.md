# Visor

Remote agent session manager. Monitor and interact with AI coding agents (Claude Code, opencode, etc.) from any device.

## What it does

- **Run AI agents** on your main PC (Claude Code, opencode, or any terminal command)
- **Monitor sessions** from your phone or another computer via a web dashboard
- **Interact remotely** — see the full terminal output, type commands, answer questions
- **Manage multiple sessions** — create, stop, restart, delete from anywhere
- **Get notified** — browser notifications when an agent asks a question

## Architecture

```
Your PC (Visor server)
├── Hono HTTP server (dashboard, API, WebSocket)
├── node-pty (manages agent processes)
└── SQLite (session persistence)

Browser (phone/tablet/PC)
├── Dashboard → list/create/manage sessions
└── xterm.js terminal → full bidirectional terminal access

CLI (visor command)
├── Interactive session picker
├── Attach to running sessions
└── Create new sessions
```

## Quick Start

```bash
# Install dependencies
npm install

# Create your .env file
cp .env.example .env
# Edit .env and set VISOR_TOKEN to a secure random string

# Build the web UI
npm run build:web

# Start the server
npm start
```

The server starts on `http://0.0.0.0:3100`. Open it in your browser and paste your token.

## CLI Usage

```bash
# Interactive mode — list sessions, create new ones
visor

# Create a session in a project directory
visor open C:\Projects\my-app                # opencode (default)
visor open C:\Projects\my-app -a claude-code # claude code

# List sessions
visor ls

# Attach to a session (by number, ID, or name)
visor attach 1
visor attach my-app

# Send input to a session without attaching
visor send 1 "yes"

# Detach from a session
# Press Ctrl+]
```

The CLI auto-loads the token from `.env` in the visor project directory.

To use `visor` as a global command, add the visor project directory to your PATH.

## Remote Access

The server binds to `0.0.0.0`, so it's accessible from any device on the same network.

**Same WiFi**: Open `http://<your-pc-ip>:3100` on your phone.

**VPN (ZeroTier/Tailscale)**: Use the VPN IP of your PC. Example: `http://10.147.x.x:3100`.

**Cloudflare Tunnel**: For access from anywhere without VPN:
```bash
cloudflared tunnel --url http://localhost:3100
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VISOR_PORT` | `3100` | Server port |
| `VISOR_HOST` | `0.0.0.0` | Bind address |
| `VISOR_TOKEN` | *(generated)* | Auth token (set this!) |
| `VISOR_DB_PATH` | `./data/visor.db` | SQLite database path |
| `VISOR_SHELL` | `powershell.exe` / `bash` | Default shell |

## Project Structure

```
visor/
├── server/src/           # Backend (Node.js + Hono + TypeScript)
│   ├── index.ts          # Entry point
│   ├── core/
│   │   ├── config.ts     # Environment configuration
│   │   ├── emitter.ts    # Internal event bus
│   │   ├── pty-manager.ts # PTY process management (node-pty)
│   │   ├── session-manager.ts # Session CRUD
│   │   └── types.ts      # Shared types
│   ├── api/
│   │   ├── auth.ts       # Bearer token auth middleware
│   │   └── routes.ts     # REST API + project discovery
│   ├── db/
│   │   └── database.ts   # SQLite via sql.js
│   └── ws/
│       └── handler.ts    # WebSocket handler
│
├── web/src/              # Frontend (React + Tailwind + Vite)
│   ├── App.tsx           # Main app
│   ├── components/
│   │   ├── Dashboard.tsx          # Session list
│   │   ├── SessionView.tsx        # Terminal view (xterm.js)
│   │   ├── CreateSessionModal.tsx # Project picker + agent selector
│   │   ├── LoginScreen.tsx        # Token auth
│   │   ├── SessionCard.tsx        # Session card
│   │   └── StatusBadge.tsx        # Status/type badges
│   ├── hooks/
│   │   └── useWebSocket.ts  # WebSocket connection
│   └── lib/
│       ├── api.ts           # REST client
│       └── types.ts         # Shared types
│
├── cli/src/
│   └── index.ts          # CLI tool
│
├── start-with-env.js     # .env loader + server start
├── start.ps1             # PowerShell start script
├── start.sh              # Bash start script
├── visor.cmd             # Global CLI wrapper (Windows)
└── visor.ps1             # Global CLI wrapper (PowerShell)
```

## Requirements

- Node.js 22+ (uses native TypeScript support)
- Windows, macOS, or Linux

## Known Limitations

- **PTY resize conflict**: When multiple devices view the same session, each resize affects all viewers. The last device to connect "wins" the terminal size.
- **TUI scroll on mobile**: Full-screen TUI apps (opencode, claude) don't generate traditional scrollback. Use the Page Up/Down buttons on the right side to scroll within the TUI.

## License

MIT
