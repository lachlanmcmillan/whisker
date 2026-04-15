import { $ } from "bun";
import chalk from "chalk";

export const host = process.env.DEPLOY_SSH_HOST;
export const remotePort = process.env.DEPLOY_SERVER_PORT ?? "3000";
export const remoteDir = process.env.DEPLOY_REMOTE_DIR;

export function requireEnv(
  name: string,
  value: string | undefined
): asserts value is string {
  if (!value) {
    process.stderr.write(`${chalk.red(`${name} is required`)}\n`);
    process.exit(1);
  }
}

// Use an interactive login shell so the remote user's profile is loaded (e.g. bun on PATH)
export const ssh = (cmd: string) =>
  $`ssh ${host} ${"/usr/bin/env bash -lic " + JSON.stringify(cmd)}`;

export const step = (msg: string) =>
  process.stdout.write(`${chalk.cyan("→")} ${msg}\n`);
export const done = (msg: string) =>
  process.stdout.write(`${chalk.green("✓")} ${msg}\n`);
