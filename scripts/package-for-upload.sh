#!/usr/bin/env bash
# Creates one zip per app in ./upload/, ready to upload to your hosting (DirectAdmin File Manager, SFTP…).
# The zips hold source only: no node_modules, no builds, no .env files, no databases — you create those on the server (see deploy/DIRECTADMIN.md).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=upload; rm -rf "$OUT"; mkdir -p "$OUT"
# zip stores paths without a leading "./", so every pattern is given both bare and nested
EX=(node_modules .next .next-dev test-results data .git upload)
FILES=("*.db" "*.db-journal" ".env" ".env.local" "*.log" ".DS_Store" "*.tsbuildinfo")
COMMON=(); for d in "${EX[@]}"; do COMMON+=(-x "$d/*" -x "*/$d/*"); done; for f in "${FILES[@]}"; do COMMON+=(-x "$f" -x "*/$f"); done

# Reader = the repo root, minus the other two apps, the native projects and local tooling
zip -qr "$OUT/ebookvox-reader.zip" . "${COMMON[@]}" -x "publisher/*" -x "admin/*" -x "android/*" -x "ios/*" -x "downloads/*" -x "mobile-www/*" -x "tests/*" -x "scripts/*" -x "docs/*" -x "app-screenshots/*" -x "catalogue/*" -x "landing/*" -x "resources/*"
for app in publisher admin; do
  (cd "$app" && zip -qr "../$OUT/ebookvox-$app.zip" . "${COMMON[@]}" -x "tests/*")
done
# Add the DirectAdmin startup file (server.js) to the top of each zip
SJ=$(mktemp -d); cp deploy/directadmin/server.js "$SJ/server.js"
for z in reader publisher admin; do (cd "$SJ" && zip -q "$OLDPWD/$OUT/ebookvox-$z.zip" server.js); done; rm -rf "$SJ"
(cd landing && zip -qr "../$OUT/ebookvox-landing.zip" .)
ls -lh "$OUT"
echo
echo "Upload each zip to its own folder on the server, extract it, then follow deploy/DIRECTADMIN.md (create .env, npm ci, prisma db push, next build)."
