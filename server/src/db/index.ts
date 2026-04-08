import { Database } from "bun:sqlite";

const dbPath = process.env.DB_PATH ?? "whisker.db";
export const db = new Database(dbPath);

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");
