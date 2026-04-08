import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

const dbPath = process.env.DB_PATH ?? "whisker.db";
const sqlite = new Database(dbPath);

sqlite.run("PRAGMA journal_mode = WAL");
sqlite.run("PRAGMA foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };

if (process.env.NODE_ENV === "production") {
  migrate(db, { migrationsFolder: "./drizzle" });
}
