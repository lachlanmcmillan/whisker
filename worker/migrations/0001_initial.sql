CREATE TABLE feeds (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL UNIQUE,
  feedUrl TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  published TEXT NOT NULL DEFAULT '',
  image TEXT,
  fetchedAt TEXT,
  refreshIntervalMins INTEGER
);

CREATE TABLE entries (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
  archivedAt TEXT,
  starredAt TEXT,
  UNIQUE(feedId, entryId)
);

CREATE TABLE Tags (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE FeedTags (
  feedId INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  tagId INTEGER NOT NULL REFERENCES Tags(id) ON DELETE CASCADE,
  PRIMARY KEY (feedId, tagId)
);

CREATE INDEX entries_feedId_published_idx ON entries(feedId, published DESC);
