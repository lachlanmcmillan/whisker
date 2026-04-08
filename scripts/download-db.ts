/**
 * Download the latest SQLite database from the remote server.
 *
 * Copies the database out of the running Docker container via SSH,
 * then downloads it to server/whisker.db.
 *
 * Required env vars (loaded from .env.local):
 *   DEPLOY_SSH_HOST - SSH destination (e.g. ubuntu@1.2.3.4)
 *
 * Usage:
 *   bun run db:pull-latest-prod
 */

import { $ } from "bun";
import chalk from "chalk";
import { host, container, requireEnv, ssh, step, done } from "./zz_common";

requireEnv("DEPLOY_SSH_HOST", host);

const remoteTmp = "/tmp/whisker-db-download.db";
const localDest = "server/whisker.db";

step(`Copying database from container ${chalk.bold(container)}...`);
await ssh(`docker cp ${container}:/data/whisker.db ${remoteTmp}`);
done("Database copied from container");

step(`Downloading to ${chalk.bold(localDest)}...`);
await $`scp ${host}:${remoteTmp} ${localDest}`;
done("Database downloaded");

step("Cleaning up remote temp file...");
await ssh(`rm ${remoteTmp}`);
done("Cleaned up");

console.log(chalk.green.bold("\n✓ Database saved to"), chalk.bold(localDest));
