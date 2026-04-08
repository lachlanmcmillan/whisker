#!/bin/sh
bun run server/src/db/migrate.ts
bun run server/src/index.ts
