#!/usr/bin/env bash
# Builds an app on THIS Mac with the live addresses and zips the result, so the hosting server never has to run `next build`.
#   bash scripts/build-for-hosting.sh reader|publisher|admin|all
# Output: upload/ebookvox-<app>-build.zip  (contains the .next folder). Upload it into the app's folder on the server and extract it.
set -euo pipefail
cd "$(dirname "$0")/.."
build() {
  local app="$1" dir env
  case "$app" in
    reader)    dir=.;        env=(APP_URL=https://app.ebookvox.com READER_PUBLIC_URL=https://app.ebookvox.com);;
    publisher) dir=publisher; env=(APP_URL=https://publisher.ebookvox.com READER_URL=https://app.ebookvox.com READER_PUBLIC_URL=https://app.ebookvox.com);;
    admin)     dir=admin;     env=(APP_URL=https://admin.ebookvox.com READER_URL=https://app.ebookvox.com PUBLISHER_URL=https://publisher.ebookvox.com);;
    *) echo "unknown app $app"; exit 1;;
  esac
  echo "== building $app"
  (cd "$dir" && rm -rf .next && env "${env[@]}" npx next build >/tmp/build-$app.log 2>&1) || { tail -20 "/tmp/build-$app.log"; exit 1; }
  mkdir -p upload
  rm -f "upload/ebookvox-$app-build.zip"
  (cd "$dir" && zip -qr "$OLDPWD/upload/ebookvox-$app-build.zip" .next -x ".next/cache/*" -x ".next/dev/*")
  ls -lh "upload/ebookvox-$app-build.zip"
}
if [ "${1:-all}" = all ]; then build reader; build publisher; build admin; else build "$1"; fi
