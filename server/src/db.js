import { Database } from "bun:sqlite";
const dbPath = process.env.DB_PATH ?? "whisker.db";
const db = new Database(dbPath);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");
db.run(`
  CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL UNIQUE,
    feedUrl TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    published TEXT NOT NULL DEFAULT '',
    image TEXT,
    fetchedAt TEXT
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedId INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    entryId TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    published TEXT NOT NULL DEFAULT '',
    updated TEXT,
    description TEXT NOT NULL DEFAULT '',
    thumbnail TEXT,
    content TEXT,
    openedAt TEXT,
    UNIQUE(feedId, entryId)
  )
`);
export { db };
