#!/usr/bin/env bash
# Runs all six suites one after another (never in parallel: they share ports) and prints a summary. Logs go to /tmp/ebookvox-test-*.log.
cd "$(dirname "$0")/.."
export SHOTS=/tmp/ebookvox-shots; mkdir -p "$SHOTS"
clean() { for p in 3100 3130 3340 3350 4010; do kill $(lsof -t -iTCP:$p -sTCP:LISTEN) 2>/dev/null; done; pkill -f mock-paystack; sleep 2; }
run() { # label dir kind
  clean; (cd "$2" && bash tests/run.sh "$3" > "/tmp/ebookvox-test-$1.log" 2>&1)
  printf "%-14s %s\n" "$1" "$(grep -E 'passed' /tmp/ebookvox-test-$1.log | tail -1)"; grep "✗" "/tmp/ebookvox-test-$1.log" | head -3 | cut -c1-200
}
run reader-api . api; run reader-ui . ui; run publisher-api publisher api; run publisher-ui publisher ui; run admin-api admin api; run admin-ui admin ui
clean
