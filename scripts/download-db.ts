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
import { host, remoteDir, requireEnv, ssh, step, done } from "./zz_common";

requireEnv("DEPLOY_SSH_HOST", host);
requireEnv("DEPLOY_REMOTE_DIR", remoteDir);

const localDest = "server/whisker.db";

const remoteEnvFile = `${remoteDir}/server/.env.local`;
step(`Reading remote DB_PATH from ${chalk.bold(remoteEnvFile)}...`);
const remoteDbPath = (
  await ssh(
    `cd ${remoteDir}/server && realpath "$(grep -E '^DB_PATH=' ${remoteEnvFile} | tail -n1 | cut -d= -f2-)"`
  ).text()
).trim();
if (!remoteDbPath) {
  process.stderr.write(
    `${chalk.red(`DB_PATH not found in ${remoteEnvFile}`)}\n`
  );
  process.exit(1);
}

step(`Downloading ${chalk.bold(remoteDbPath)} from ${chalk.bold(host)}...`);
await $`scp ${host}:${remoteDbPath} ${localDest}`;
done("Database downloaded");

process.stdout.write(
  `${chalk.green.bold("\n✓ Database saved to")} ${chalk.bold(localDest)}\n`
);
