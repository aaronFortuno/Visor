#!/usr/bin/env bash
# Visor — Start script (Bash/Git Bash)
# Loads .env and starts the server

set -a
source "$(dirname "$0")/.env" 2>/dev/null
set +a

echo ""
echo "  Token: ${VISOR_TOKEN:0:8}..."
echo ""

node --experimental-strip-types server/src/index.ts
