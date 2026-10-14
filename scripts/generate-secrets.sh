#!/usr/bin/env bash
# Prints fresh random values for the secrets you invent yourself. Copy each into the .env files named beside it.
# Nothing is written to disk. Usage: bash scripts/generate-secrets.sh
r() { openssl rand -hex 32; }
echo "PUBLISHER_API_KEY=\"$(r)\"        # Reader/.env  AND  publisher/.env (same value in both)"
echo "PUBLISHER_WEBHOOK_SECRET=\"$(r)\"  # Reader/.env  — and the SAME value as READER_WEBHOOK_SECRET in publisher/.env"
echo "READER_WEBHOOK_SECRET=\"<same value as PUBLISHER_WEBHOOK_SECRET above>\"   # publisher/.env"
echo "READER_ADMIN_SECRET=\"$(r)\"       # Reader/.env  AND  admin/.env (same value in both)"
echo "PUBLISHER_ADMIN_SECRET=\"$(r)\"    # publisher/.env  AND  admin/.env (same value in both)"
