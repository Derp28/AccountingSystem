#!/usr/bin/env bash
set -euo pipefail

NODE_BIN="$HOME/.nvm/versions/node/v24.22.0/bin"
if [ -x "$NODE_BIN/node" ]; then
  export PATH="$NODE_BIN:$PATH"
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# WSL hosts without sudo can unpack the needed shared libraries into a
# user-local directory; see scripts/setup-local-browser-libs.sh.
if [ -d "$HOME/.local/playwright-libs/usr/lib/x86_64-linux-gnu" ]; then
  export LD_LIBRARY_PATH="$HOME/.local/playwright-libs/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

npx playwright test "$@"
