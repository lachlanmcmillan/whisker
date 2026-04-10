module.exports = {
  apps: [
    {
      name: "whisker",
      script: "bun",
      args: "server/src/index.ts",
      cwd: __dirname,
      interpreter: "none",
      watch: false,
    },
  ],
};
