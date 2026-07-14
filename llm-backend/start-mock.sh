#!/bin/bash
# ============================================================
#  start-mock.sh — Starts the Mock Inference Server
#  Usage: bash start-mock.sh
# ============================================================

# Load nvm so 'node' is available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo ""
echo "  Starting Replay Engine (Edge AI Demo)..."
echo "  Directory: $SCRIPT_DIR"
echo ""

# Use nodemon for hot-reload during dev, fallback to node
if command -v npx &>/dev/null && [ -f node_modules/.bin/nodemon ]; then
  npx nodemon index.js
else
  node index.js
fi
