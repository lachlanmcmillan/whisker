#!/usr/bin/env bash
set -euo pipefail

CURRENT_DATE=$(date +%Y%m%d%H%M%S)
APP_NAME="whisker"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR/server"

echo "==> Stopping App"
pm2 stop "whisker"

echo "==> Installing dependencies"
bun install

echo "==> Backing up database"
cp $DB_PATH $DB_PATH.$CURRENT_DATE.bak

echo "==> Running migrations"
bunx --bun prisma migrate deploy

echo "==> Restarting ${APP_NAME} via pm2"
pm2 start "ecosystem.config.cjs"
pm2 status "$APP_NAME"
