import { $ } from "bun";
import chalk from "chalk";

export const host = process.env.DEPLOY_SSH_HOST;
export const remotePort = process.env.DEPLOY_SERVER_PORT ?? "3000";
export const apiKey = process.env.API_KEY;
export const corsOrigin = process.env.DEPLOY_CORS_ORIGIN;
export const container = "whisker";

export function requireEnv(name: string, value: string | undefined): asserts value is string {
  if (!value) {
    console.error(chalk.red(`${name} is required`));
    process.exit(1);
  }
}

export const ssh = (cmd: string) => $`ssh ${host} ${cmd}`.text();

export const step = (msg: string) => console.log(chalk.cyan("→"), msg);
export const done = (msg: string) => console.log(chalk.green("✓"), msg);

export async function uploadFile(localPath: string, remoteTarget: string) {
  const totalMB = (Bun.file(localPath).size / 1024 / 1024).toFixed(1);
  step(`Uploading image to server (${totalMB}MB)...`);

  const proc = Bun.spawnSync(["scp", "-o", "LogLevel=ERROR", localPath, remoteTarget], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  if (proc.exitCode !== 0) {
    console.error(chalk.red("✗"), "Upload failed");
    process.exit(1);
  }
}
