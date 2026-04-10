import { defineConfig } from "prisma/config";

const { DB_PATH } = process.env;
if (!DB_PATH) throw new Error("DB_PATH not set");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: `file:${DB_PATH}`,
  },
});
