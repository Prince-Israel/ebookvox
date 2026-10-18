#!/usr/bin/env bash
# Starts the Reader (:3230), Publisher (:3240) and Admin (:3250) from their production builds and leaves them running in the background.
# The mobile app loads the Reader from this Mac, so if these are not running the app can only show its "Connect to internet" page.
#   bash scripts/start-all.sh            start whatever isn't running
#   bash scripts/start-all.sh --restart  restart all three (do this after editing a .env or rebuilding)
cd "$(dirname "$0")/.."
[ "${1:-}" = "--restart" ] && { pkill -f "next start -p 32[345]0" 2>/dev/null; sleep 1; }
start() { # dir port
  if curl -s -o /dev/null -m 2 "localhost:$2/"; then echo "  :$2 already running"; return; fi
  [ -f "$1/.next/BUILD_ID" ] || { echo "  :$2 has no build — run: (cd $1 && npx next build)"; return; }
  (cd "$1" && nohup npx next start -p "$2" >"/tmp/ebookvox-$2.log" 2>&1 &)
  for _ in $(seq 1 30); do curl -s -o /dev/null -m 2 "localhost:$2/" && { echo "  :$2 up"; return; }; sleep 1; done
  echo "  :$2 did not start — see /tmp/ebookvox-$2.log"
}
start . 3230; start publisher 3240; start admin 3250
echo "Phones on the same Wi-Fi reach the Reader at http://$(ipconfig getifaddr en0 2>/dev/null || hostname):3230"
