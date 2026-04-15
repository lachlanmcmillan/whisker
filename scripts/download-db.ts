/**
 * Download the latest SQLite database from the remote server.
 *
 * Copies the database from the remote host via SCP.
 *
 * Required env vars (loaded from .env.local):
 *   DEPLOY_SSH_HOST  - SSH destination (e.g. ubuntu@1.2.3.4)
 *   DEPLOY_REMOTE_DIR - Path to the repo on the server
 *
 * Usage:
 *   bun run db:pull-latest-prod
 */

import { $ } from "bun";
import chalk from "chalk";
import { host, remoteDir, requireEnv, step, done } from "./zz_common";

requireEnv("DEPLOY_SSH_HOST", host);
requireEnv("DEPLOY_REMOTE_DIR", remoteDir);

const localDest = "server/whisker.db";

step(`Downloading database from ${chalk.bold(host)}...`);
await $`scp ${host}:${remoteDir}/whisker.db ${localDest}`;
done("Database downloaded");

process.stdout.write(
  `${chalk.green.bold("\n✓ Database saved to")} ${chalk.bold(localDest)}\n`
);
