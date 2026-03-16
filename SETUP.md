# Visor — Setup Guide

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the web UI
npm run build:web

# 3. Start the server
VISOR_TOKEN=your-secret-token npm start

# Server runs at http://0.0.0.0:3100
# Open browser → paste token → done
```

## CLI Usage

```bash
export VISOR_TOKEN=your-secret-token
export VISOR_URL=http://your-pc-ip:3100  # only needed if not localhost

# List sessions
node --experimental-strip-types cli/src/index.ts list

# Create a session
node --experimental-strip-types cli/src/index.ts new claude-code my-project

# Attach to a session (live terminal)
node --experimental-strip-types cli/src/index.ts attach <session-id>

# Send input without attaching
node --experimental-strip-types cli/src/index.ts send <session-id> "y"

# Detach from session: Ctrl+]
```

## Remote Access Options

All options below expose `http://<ip>:3100` to your mobile/other devices.
The server is agnostic — pick whichever method fits your setup.

---

### Option 1: Same WiFi (simplest)

If your phone and PC are on the same WiFi:

1. Find your PC's local IP: `ipconfig` (Windows) or `ip addr` (Linux)
2. Open `http://192.168.x.x:3100` on your phone
3. Done.

**Limitation**: Only works on the same network.

---

### Option 2: ZeroTier (you already have this)

You already have ZeroTier on your phone and router.

1. Make sure your PC has joined the same ZeroTier network
2. Find the ZeroTier IP of your PC:
   ```
   zerotier-cli listnetworks
   ```
   Look for the IP like `10.147.x.x` or `172.x.x.x`
3. Open `http://<zerotier-ip>:3100` on your phone
4. Done.

**For CLI from another device**:
```bash
export VISOR_URL=http://<zerotier-ip>:3100
export VISOR_TOKEN=your-token
node --experimental-strip-types cli/src/index.ts list
```

---

### Option 3: Tailscale

Similar to ZeroTier but with magic DNS names.

1. Install Tailscale on PC and phone: https://tailscale.com/download
2. Login with same account on both
3. Your PC gets an IP like `100.x.x.x` and a name like `my-pc`
4. Open `http://my-pc:3100` on your phone
5. Done.

---

### Option 4: Cloudflare Tunnel (access from anywhere, no VPN needed)

Exposes your local server via a public HTTPS domain.
Requires a Cloudflare account (free) and a domain.

1. Install cloudflared:
   ```
   # Windows
   winget install cloudflare.cloudflared

   # Linux
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
   chmod +x cloudflared
   ```

2. Login:
   ```
   cloudflared tunnel login
   ```

3. Create tunnel:
   ```
   cloudflared tunnel create visor
   cloudflared tunnel route dns visor visor.yourdomain.com
   ```

4. Run tunnel:
   ```
   cloudflared tunnel --url http://localhost:3100 run visor
   ```

5. Open `https://visor.yourdomain.com` on any device
6. Done.

**Note**: The VISOR_TOKEN auth protects against unauthorized access.
With Cloudflare Tunnel + token auth, you have two layers of security.

---

## Install as PWA (Mobile App)

Visor can be installed as a Progressive Web App on your phone for a native-like experience: standalone mode (no browser chrome), home screen icon, and cached app shell for fast loading.

### iOS (Safari)

1. Open Visor in **Safari** (PWA install only works in Safari on iOS)
2. Tap the **Share** button (square with upward arrow) at the bottom
3. Scroll down and tap **"Add to Home Screen"**
4. Give it a name (default: "Visor") and tap **"Add"**
5. Visor now appears on your home screen as a standalone app

### Android (Chrome)

1. Open Visor in **Chrome**
2. Tap the **three-dot menu** at the top right
3. Tap **"Install app"** or **"Add to Home Screen"**
4. Confirm the installation
5. Visor now appears in your app drawer and home screen

### Desktop (Chrome / Edge)

1. Open Visor in Chrome or Edge
2. Click the **install icon** in the address bar (or three-dot menu → "Install Visor")
3. Confirm

### What PWA gives you

- **Standalone mode**: No browser address bar or navigation — full screen for Visor
- **Home screen icon**: Launch Visor like a native app
- **Cached shell**: The app shell (HTML, CSS, JS) is cached by the service worker, so loading is fast even on slow connections
- **Offline fallback**: If the server is unreachable, you see the cached app instead of a browser error page

**Note**: The PWA still requires a network connection to interact with sessions — the service worker only caches the app shell, not the real-time terminal data.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VISOR_PORT` | `3100` | Server port |
| `VISOR_HOST` | `0.0.0.0` | Bind address |
| `VISOR_TOKEN` | (auto-generated) | Auth token |
| `VISOR_DB_PATH` | `./data/visor.db` | SQLite database path |
| `VISOR_SHELL` | `powershell.exe` / `/bin/bash` | Default shell |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API URL |

## Notifications

The web UI can send browser notifications when agents ask questions.
Click the bell icon in the dashboard to enable. Works on mobile browsers too.

**Note**: Notifications require the page to be open (but not focused).
For background notifications when the browser is closed, you'd need
HTTPS + service worker (available with Cloudflare Tunnel setup).

## Using the Web UI

### Dashboard

The dashboard shows all sessions as cards in a responsive grid. Each card shows:
- Session name and agent type (claude-code, opencode, shell)
- Status indicator (running, stopped, error)
- Time since creation

Tap **"+ New Session"** to create a new session. The modal lets you:
- Pick an agent type (Claude Code, opencode, or custom shell)
- Select a project directory from auto-discovered folders
- Or enter a custom path

### Session View

When you tap a session, you enter the session view with two modes:

**Terminal mode** (default on desktop):
- Full xterm.js terminal with bidirectional I/O
- On desktop: floating scroll control buttons on the right
- On mobile: a toolbar at the bottom with navigation keys (Tab, Esc, arrows), control keys (Ctrl+C/D/Z/L, Enter, y, n), slash command panel, text input with history, and context action buttons

**Chat mode** (default on mobile):
- Agent output rendered as message bubbles with markdown formatting
- Code blocks with syntax highlighting
- Quick action buttons: Ctrl+C, y, n, Enter
- Slash command popup (type `/` to open)
- Text input with send button, optimized for mobile keyboards
- Input history (arrow up/down on desktop, stored in localStorage)

The header bar contains:
- Back button (return to dashboard)
- Session name, type badge, and status
- **View toggle** — switch between Terminal and Chat mode
- Session controls: Restart, Stop/Start, Delete
