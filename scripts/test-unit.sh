#!/usr/bin/env bash
set -euo pipefail

NODE_BIN="$HOME/.nvm/versions/node/v24.22.0/bin"
if [ -x "$NODE_BIN/node" ]; then
  export PATH="$NODE_BIN:$PATH"
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

node --test tests/unit/*.test.js
