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
