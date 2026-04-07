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
  const [remoteHost, remotePath] = remoteTarget.split(":");
  const totalBytes = Bun.file(localPath).size;
  const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
  step(`Uploading image to server (${totalMB}MB)...`);

  const cat = Bun.spawn(["cat", localPath], { stdout: "pipe" });
  const sshUpload = Bun.spawn(["ssh", remoteHost, `cat > ${remotePath}`], {
    stdin: "pipe",
    stdout: "inherit",
    stderr: "inherit",
  });

  let uploaded = 0;
  const reader = cat.stdout.getReader();
  while (true) {
    const { done: eof, value } = await reader.read();
    if (eof) break;
    sshUpload.stdin.write(value);
    uploaded += value.byteLength;
    const pct = ((uploaded / totalBytes) * 100).toFixed(0);
    const upMB = (uploaded / 1024 / 1024).toFixed(1);
    process.stdout.write(
      `\r  ${chalk.dim(`${upMB}MB / ${totalMB}MB (${pct}%)`)}`
    );
  }
  await sshUpload.stdin.end();
  const exitCode = await sshUpload.exited;
  process.stdout.write("\r" + " ".repeat(40) + "\r");
  if (exitCode !== 0) {
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

step("Saving image...");
await $`docker save ${image} | gzip > ${tarball}`;
done("Image saved");

await uploadFile(tarball, `${host}:${tarball}`);
done("Image uploaded");

step("Loading image on server...");
await ssh(`docker load -i ${tarball}`);
done("Image loaded");

step("Stopping existing container...");
await ssh(`docker stop ${container} 2>/dev/null || true`);
await ssh(`docker rm ${container} 2>/dev/null || true`);
done("Container stopped");

step("Starting new container...");
await ssh(
  `docker run -d --name ${container} --restart unless-stopped -p ${remotePort}:3000 -v whisker-data:/data -e DB_PATH=/data/whisker.db ${image}`
);
done("Container started");

step("Cleaning up...");
await ssh(`rm ${tarball}`);
await $`rm ${tarball}`;
done("Cleaned up");

console.log(
  chalk.green.bold("\n✓ Deployed"),
  chalk.bold(image),
  chalk.green.bold("to"),
  chalk.bold(`${host}:${remotePort}`)
);
