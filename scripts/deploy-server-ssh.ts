/**
 * Deploy the Whisker server to a remote host via SSH.
 *
 * Builds a Docker image locally, uploads it to the server via scp,
 * then stops the old container and starts the new one. Finishes with
 * a health check against /monitor to verify the deploy succeeded.
 *
 * Required env vars:
 *   DEPLOY_SSH_HOST       - SSH destination (e.g. ubuntu@1.2.3.4)
 *   DEPLOY_SERVER_PORT    - Port to expose on the remote host (default: 3000)
 *
 * Usage:
 *   bun run deploy-server-ssh
 */

import { $ } from "bun";
import chalk from "chalk";

const host = process.env.DEPLOY_SSH_HOST;
const remotePort = process.env.DEPLOY_SERVER_PORT ?? "3000";
const container = "whisker";

if (!host) {
  console.error(chalk.red("DEPLOY_SSH_HOST is required (e.g. ubuntu@1.2.3.4)"));
  process.exit(1);
}

const sha = (await $`git rev-parse --short HEAD`.text()).trim();
const image = `whisker-server:${sha}`;
const tarball = `/tmp/whisker-server-${sha}.tar.gz`;

const ssh = (cmd: string) => $`ssh ${host} ${cmd}`.text();

async function uploadFile(localPath: string, remoteTarget: string) {
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

const step = (msg: string) => console.log(chalk.cyan("→"), msg);
const done = (msg: string) => console.log(chalk.green("✓"), msg);

step(`Testing SSH connection to ${chalk.bold(host)}...`);
try {
  await ssh("echo ok");
  done("Connected");
} catch {
  console.error(chalk.red("✗"), `Failed to connect to ${host}`);
  process.exit(1);
}

step(`Building Docker image ${chalk.bold(image)}...`);
await $`docker build -t ${image} -f ./server/Dockerfile .`;
done("Image built");

step(`Saving image to ${chalk.bold(tarball)}...`);
await $`docker save ${image} | gzip > ${tarball}`;
done(`Image saved (${(Bun.file(tarball).size / 1024 / 1024).toFixed(1)}MB)`);

await uploadFile(tarball, `${host}:${tarball}`);
done("Image uploaded");

step(`Loading image on ${chalk.bold(host)}...`);
await ssh(`docker load -i ${tarball}`);
done("Image loaded");

step(`Stopping existing container ${chalk.bold(container)}...`);
await ssh(`docker stop ${container} 2>/dev/null || true`);
await ssh(`docker rm ${container} 2>/dev/null || true`);
done("Container stopped");

step(`Starting container ${chalk.bold(container)} on port ${chalk.bold(remotePort)}...`);
await ssh(
  `docker run -d --name ${container} --restart unless-stopped -p ${remotePort}:3000 -v whisker-data:/data -e DB_PATH=/data/whisker.db -e COMMIT_SHA=${sha} ${image}`
);
done("Container started");

step("Running health check...");
const monitor = await ssh(`curl -s http://localhost:${remotePort}/monitor`);
const health = JSON.parse(monitor);
if (health.commit !== sha) {
  console.error(chalk.red("✗"), `Expected commit ${sha}, got ${health.commit}`);
  process.exit(1);
}
done(`Healthy — commit ${chalk.bold(health.commit)}, uptime ${health.uptimeSeconds}s`);

step(`Cleaning up ${chalk.bold(tarball)}...`);
await ssh(`rm ${tarball}`);
await $`rm ${tarball}`;
done("Cleaned up");

console.log(
  chalk.green.bold("\n✓ Deployed"),
  chalk.bold(image),
  chalk.green.bold("to"),
  chalk.bold(`${host}:${remotePort}`)
);
