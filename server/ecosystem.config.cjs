module.exports = {
  apps: [
    {
      name: "whisker",
      script: "bun",
      args: "run start",
      cwd: __dirname,
      interpreter: "none",
      watch: false,
    },
  ],
};
