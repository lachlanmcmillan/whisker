export const startedAt = Date.now();

export const commitSha =
  process.env.COMMIT_SHA ??
  (() => {
    try {
      const result = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"]);
      return result.stdout.toString().trim() || "dev";
    } catch {
      return "dev";
    }
  })();
