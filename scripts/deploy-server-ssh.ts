/**
 * Deploy the Whisker server to a remote host via SSH.
 *
 * SSHs into the server, pulls the latest code, and runs the deploy
 * script which installs deps, runs migrations, and restarts PM2.
 * Finishes with a health check against /monitor.
 *
 * Required env vars:
 *   DEPLOY_SSH_HOST       - SSH destination (e.g. ubuntu@1.2.3.4)
 *   DEPLOY_REMOTE_DIR     - Path to the repo on the server
 *
 * Optional env vars:
 *   DEPLOY_SERVER_PORT    - Port the server listens on (default: 3000)
 *
 * Usage:
 *   bun run deploy-server-ssh
 */

import chalk from "chalk";
import {
  host,
  remotePort,
  remoteDir,
  requireEnv,
  ssh,
  step,
  done,
} from "./zz_common";

requireEnv("DEPLOY_SSH_HOST", host);
requireEnv("DEPLOY_REMOTE_DIR", remoteDir);

step(`Testing SSH connection to ${chalk.bold(host)}...`);
try {
  await ssh("echo ok");
  done("Connected");
} catch {
  console.error(chalk.red("✗"), `Failed to connect to ${host}`);
  process.exit(1);
}

step(`Pulling latest code in ${chalk.bold(remoteDir)}...`);
await ssh(`cd ${remoteDir} && git pull`);
done("Code updated");

const sha = (await ssh(`cd ${remoteDir} && git rev-parse --short HEAD`)).stdout.toString().trim();

step(`Running deploy script...`);
await ssh(`cd ${remoteDir} && bash scripts/deploy.sh`);
done("Deploy script completed");

step("Running health check...");
const monitor = await ssh(`curl -s http://localhost:${remotePort}/monitor`);
const health = JSON.parse(monitor.stdout.toString());
if (health.commit !== sha) {
  console.error(chalk.red("✗"), `Expected commit ${sha}, got ${health.commit}`);
  process.exit(1);
}
done(`Healthy — commit ${chalk.bold(health.commit)}, uptime ${health.uptimeSeconds}s`);

console.log(
  chalk.green.bold("\n✓ Deployed"),
  chalk.bold(sha),
  chalk.green.bold("to"),
  chalk.bold(`${host}:${remotePort}`)
);
