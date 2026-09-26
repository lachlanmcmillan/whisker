CREATE TABLE Users (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  createdAt TEXT NOT NULL,
  disabledAt TEXT
);

CREATE TABLE Sessions (
  tokenHash TEXT NOT NULL PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);
CREATE INDEX Sessions_userId_idx ON Sessions(userId);

CREATE TABLE AccountTokens (
  tokenHash TEXT NOT NULL PRIMARY KEY,
  userId TEXT REFERENCES Users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('setup', 'invite', 'reset')),
  createdBy TEXT REFERENCES Users(id) ON DELETE SET NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  usedAt TEXT
);
CREATE INDEX AccountTokens_email_purpose_idx ON AccountTokens(email, purpose);

CREATE TABLE LoginAttempts (
  key TEXT NOT NULL PRIMARY KEY,
  attempts INTEGER NOT NULL,
  firstAt TEXT NOT NULL
);

CREATE TABLE UserFeeds (
  userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  feedId INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  titleOverride TEXT,
  descriptionOverride TEXT,
  authorOverride TEXT,
  imageOverride TEXT,
  linkOverride TEXT,
  refreshIntervalMins INTEGER,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (userId, feedId)
);
CREATE INDEX UserFeeds_feedId_idx ON UserFeeds(feedId);

CREATE TABLE UserEntryStates (
  userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  entryId INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  openedAt TEXT,
  archivedAt TEXT,
  starredAt TEXT,
  PRIMARY KEY (userId, entryId)
);

CREATE TABLE UserTags (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (userId, id),
  UNIQUE (userId, name)
);

CREATE TABLE UserFeedTags (
  userId TEXT NOT NULL,
  feedId INTEGER NOT NULL,
  tagId INTEGER NOT NULL,
  PRIMARY KEY (userId, feedId, tagId),
  FOREIGN KEY (userId, feedId) REFERENCES UserFeeds(userId, feedId) ON DELETE CASCADE,
  FOREIGN KEY (userId, tagId) REFERENCES UserTags(userId, id) ON DELETE CASCADE
);
