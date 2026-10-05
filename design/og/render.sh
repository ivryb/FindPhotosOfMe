#!/usr/bin/env bash
# Screenshots every option in og.js to png/<id>.png at 1200×630 with Playwright's headless Chromium.
set -euo pipefail
cd "$(dirname "$0")"
chrome=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell | tail -1)
mkdir -p png
for id in $(grep -oE 'id: "[a-z0-9-]+"' og.js | cut -d'"' -f2); do
  case $id in event-*) boards="$id-1 $id-2" ;; *) boards=$id ;; esac
  for board in $boards; do
    "$chrome" --headless --hide-scrollbars --allow-file-access-from-files --virtual-time-budget=4000 \
      --window-size=1200,630 --screenshot="png/$board.png" "file://$PWD/index.html?board=$board" 2>/dev/null
  done
done
ls png
