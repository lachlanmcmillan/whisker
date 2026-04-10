import { $ } from "bun";
import chalk from "chalk";

export const host = process.env.DEPLOY_SSH_HOST;
export const remotePort = process.env.DEPLOY_SERVER_PORT ?? "3000";
export const remoteDir = process.env.DEPLOY_REMOTE_DIR;

export function requireEnv(name: string, value: string | undefined): asserts value is string {
  if (!value) {
    console.error(chalk.red(`${name} is required`));
    process.exit(1);
  }
}

export const ssh = (cmd: string) => $`ssh ${host} ${cmd}`.text();

export const step = (msg: string) => console.log(chalk.cyan("→"), msg);
export const done = (msg: string) => console.log(chalk.green("✓"), msg);
