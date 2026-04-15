const path = require("node:path");

const logDir = process.env.LOG_DIR ?? __dirname;

module.exports = {
  apps: [
    {
      name: "whisker",
      script: "bun",
      args: "run start",
      cwd: __dirname,
      interpreter: "none",
      watch: false,
      out_file: path.join(logDir, "whisker-out.jsonl"),
      error_file: path.join(logDir, "whisker-error.jsonl"),
      env: {
        LOG_DIR: logDir,
      },
    },
  ],
};
