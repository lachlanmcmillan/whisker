import { startBackgroundRefreshScheduler } from "./lib/feed/refresh";
import { logger } from "./lib/logger";
import { dispatch } from "./routes";
import { commitSha } from "./runtime";

const server = Bun.serve({
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  fetch(req) {
    return dispatch(req);
  },
});

logger.info({
  event: "server_started",
  port: server.port,
  url: `http://localhost:${server.port}`,
  commitSha,
});
startBackgroundRefreshScheduler();
