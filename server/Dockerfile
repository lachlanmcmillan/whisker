FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY common/package.json common/
COPY server/package.json server/
COPY client/package.json client/
RUN bun install --frozen-lockfile --verbose
COPY common common
COPY server server

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/common common
COPY --from=build /app/server server
EXPOSE 3000
COPY server/entrypoint.sh .
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
