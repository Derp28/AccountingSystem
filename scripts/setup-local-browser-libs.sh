#!/usr/bin/env bash
# Dev-only helper for WSL hosts without sudo: unpack the few Chromium shared
# libraries into a user-local directory and expose them to Playwright.
set -euo pipefail

BASE="$HOME/.local/playwright-libs"
DEBS="$HOME/.local/playwright-debs"
mkdir -p "$BASE" "$DEBS"
cd "$DEBS"

if ! ls ./*.deb >/dev/null 2>&1; then
  apt-get download libnspr4 libnss3 libasound2t64
fi

for package in ./*.deb; do
  dpkg-deb -x "$package" "$BASE"
done

find "$BASE" \( -name libnspr4.so -o -name libnss3.so -o -name libasound.so.2 \) -print
