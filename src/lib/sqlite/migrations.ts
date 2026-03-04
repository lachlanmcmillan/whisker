export interface Migration {
  version: number;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        link TEXT NOT NULL UNIQUE,
        author TEXT NOT NULL DEFAULT '',
        published TEXT NOT NULL DEFAULT '',
        image TEXT
      );

      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
        entry_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        link TEXT NOT NULL DEFAULT '',
        author TEXT NOT NULL DEFAULT '',
        published TEXT NOT NULL DEFAULT '',
        updated TEXT,
        description TEXT NOT NULL DEFAULT '',
        thumbnail TEXT,
        content TEXT,
        UNIQUE(feed_id, entry_id)
      );
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE entries RENAME COLUMN feed_id TO feedId;
      ALTER TABLE entries RENAME COLUMN entry_id TO entryId;
    `,
  },
];
