#!/usr/bin/env bash
# Thin wrapper for Linux/WSL/CI shells. All logic lives in scripts/dev.mjs so
# Windows, WSL, and Docker run exactly the same code.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# On WSL the project Node is installed with NVM and may not be on PATH.
NODE_BIN="${LEDGERLINE_NODE_BIN:-$HOME/.nvm/versions/node/v24.22.0/bin}"
if [ -x "$NODE_BIN/node" ]; then
  export PATH="$NODE_BIN:$PATH"
fi

exec node scripts/dev.mjs "$@"
