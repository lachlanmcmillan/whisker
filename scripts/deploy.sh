#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/server"

echo "==> Installing dependencies"
bun install

echo "==> Running migrations"
bun run src/db/migrate.ts

APP_NAME="whisker"

if command -v pm2 >/dev/null 2>&1; then
  echo "==> Restarting ${APP_NAME} via pm2"
  pm2 restart "$APP_NAME" || pm2 start "ecosystem.config.cjs"
  pm2 status "$APP_NAME"
else
  echo "pm2 not found, skipping process restart"
fi
