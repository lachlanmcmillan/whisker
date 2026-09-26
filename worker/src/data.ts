import {
  fetchFeed,
  type Feed as ParsedFeed,
} from "./feed/fetch";

export interface FeedRow {
  id: number;
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  author: string;
  published: string;
  image: string | null;
  fetchedAt: string | null;
  refreshIntervalMins: number | null;
}

export interface EntryRow {
  id: number;
  feedId: number;
  entryId: string;
  title: string;
  link: string;
  author: string;
  published: string;
  updated: string | null;
  description: string;
  thumbnail: string | null;
  content: string | null;
  openedAt: string | null;
  archivedAt: string | null;
  starredAt: string | null;
}

export interface TagRow {
  id: number;
  name: string;
}

export type FeedWithEntries = FeedRow & { entries: EntryRow[]; tags: TagRow[] };

export async function readFeeds(
  db: D1Database,
  userId: string
): Promise<FeedWithEntries[]> {
  const { results: feedRows } = await db
    .prepare(
      `SELECT f.id, COALESCE(uf.titleOverride, f.title) AS title,
      COALESCE(uf.descriptionOverride, f.description) AS description,
      COALESCE(uf.linkOverride, f.link) AS link, f.feedUrl,
      COALESCE(uf.authorOverride, f.author) AS author, f.published,
      COALESCE(uf.imageOverride, f.image) AS image, f.fetchedAt,
      uf.refreshIntervalMins FROM UserFeeds uf
      JOIN feeds f ON f.id = uf.feedId WHERE uf.userId = ? ORDER BY uf.createdAt`
    )
    .bind(userId)
    .all<FeedRow>();
  if (feedRows.length === 0) return [];

  const [entries, tagged] = await Promise.all([
    db
      .prepare(
        `SELECT e.id, e.feedId, e.entryId, e.title, e.link, e.author,
      e.published, e.updated, e.description, e.thumbnail, e.content,
      s.openedAt, s.archivedAt, s.starredAt FROM entries e
      JOIN UserFeeds uf ON uf.feedId = e.feedId AND uf.userId = ?
      LEFT JOIN UserEntryStates s ON s.entryId = e.id AND s.userId = ?
      ORDER BY e.published DESC`
      )
      .bind(userId, userId)
      .all<EntryRow>(),
    db
      .prepare(
        `SELECT ft.feedId, t.id, t.name FROM UserFeedTags ft
      JOIN UserTags t ON t.id = ft.tagId AND t.userId = ft.userId
      WHERE ft.userId = ? ORDER BY t.id`
      )
      .bind(userId)
      .all<TagRow & { feedId: number }>(),
  ]);

  const entriesByFeed = new Map<number, EntryRow[]>();
  const tagsByFeed = new Map<number, TagRow[]>();
  for (const entry of entries.results) {
    const list = entriesByFeed.get(entry.feedId) ?? [];
    list.push(entry);
    entriesByFeed.set(entry.feedId, list);
  }
  for (const { feedId, id, name } of tagged.results) {
    const list = tagsByFeed.get(feedId) ?? [];
    list.push({ id, name });
    tagsByFeed.set(feedId, list);
  }
  return feedRows.map(row => ({
    ...row,
    entries: entriesByFeed.get(row.id) ?? [],
    tags: tagsByFeed.get(row.id) ?? [],
  }));
}

export async function readFeed(
  db: D1Database,
  userId: string,
  id: number
): Promise<FeedWithEntries | null> {
  return (await readFeeds(db, userId)).find(feed => feed.id === id) ?? null;
}

export async function readFeedTags(
  db: D1Database,
  userId: string,
  id: number
): Promise<TagRow[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id, t.name FROM UserTags t
    JOIN UserFeedTags ft ON ft.tagId = t.id AND ft.userId = t.userId
    WHERE ft.userId = ? AND ft.feedId = ? ORDER BY t.id`
    )
    .bind(userId, id)
    .all<TagRow>();
  return results;
}

export async function upsertFeed(
  db: D1Database,
  feed: ParsedFeed
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO feeds
    (title, description, link, feedUrl, author, published, image, fetchedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(link) DO UPDATE SET
      title = excluded.title, description = excluded.description,
      feedUrl = excluded.feedUrl, author = excluded.author,
      published = excluded.published, image = excluded.image,
      fetchedAt = excluded.fetchedAt`
    )
    .bind(
      feed.title,
      feed.description,
      feed.link,
      feed.feedUrl,
      feed.author,
      feed.published,
      feed.image ?? null,
      feed.fetchedAt ?? null
    )
    .run();

  const row = await db
    .prepare("SELECT id FROM feeds WHERE link = ?")
    .bind(feed.link)
    .first<{ id: number }>();
  if (!row) throw new Error("Feed was not saved");

  // D1 batch executes these statements atomically. Preserve read state by
  // updating only feed-sourced fields when an entry already exists.
  for (let offset = 0; offset < feed.entries.length; offset += 100) {
    const statements = feed.entries.slice(offset, offset + 100).map(entry =>
      db
        .prepare(
          `INSERT INTO entries
        (feedId, entryId, title, link, author, published, updated, description, thumbnail, content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(feedId, entryId) DO UPDATE SET
          title = excluded.title, link = excluded.link,
          author = excluded.author, published = excluded.published,
          updated = excluded.updated, description = excluded.description,
          thumbnail = excluded.thumbnail, content = excluded.content`
        )
        .bind(
          row.id,
          entry.entryId,
          entry.title,
          entry.link,
          entry.author,
          entry.published,
          entry.updated ?? null,
          entry.description,
          entry.thumbnail ?? null,
          entry.content ?? null
        )
    );
    await db.batch(statements);
  }
  return row.id;
}

export async function importFeeds(
  db: D1Database,
  userId: string,
  feeds: ParsedFeed[]
): Promise<void> {
  const feedJson = JSON.stringify(
    feeds.map(feed => ({
      title: feed.title,
      description: feed.description,
      link: feed.link,
      feedUrl: feed.feedUrl,
      author: feed.author,
      published: feed.published,
      image: feed.image ?? null,
      fetchedAt: feed.fetchedAt ?? null,
    }))
  );
  const entryJson = JSON.stringify(
    feeds.flatMap(feed =>
      feed.entries.map(entry => ({
        feedLink: feed.link,
        entryId: entry.entryId,
        title: entry.title,
        link: entry.link,
        author: entry.author,
        published: entry.published,
        updated: entry.updated ?? null,
        description: entry.description,
        thumbnail: entry.thumbnail ?? null,
        content: entry.content ?? null,
      }))
    )
  );
  const encoder = new TextEncoder();
  if (
    encoder.encode(feedJson).length > 1_800_000 ||
    encoder.encode(entryJson).length > 1_800_000
  )
    throw new InputError("Import is too large; use smaller batches");

  // One D1 batch is a transaction: a failed feed or entry write rolls back
  // every subscription and content change in this import.
  await db.batch([
    db
      .prepare(
        `INSERT INTO feeds
      (title, description, link, feedUrl, author, published, image, fetchedAt)
      SELECT json_extract(j.value, '$.title'),
        COALESCE(json_extract(j.value, '$.description'), ''),
        json_extract(j.value, '$.link'),
        COALESCE(json_extract(j.value, '$.feedUrl'), ''),
        COALESCE(json_extract(j.value, '$.author'), ''),
        COALESCE(json_extract(j.value, '$.published'), ''),
        json_extract(j.value, '$.image'), json_extract(j.value, '$.fetchedAt')
      FROM json_each(?) AS j WHERE 1
      ON CONFLICT(link) DO UPDATE SET
        title = excluded.title, description = excluded.description,
        feedUrl = excluded.feedUrl, author = excluded.author,
        published = excluded.published, image = excluded.image,
        fetchedAt = excluded.fetchedAt`
      )
      .bind(feedJson),
    db
      .prepare(
        `INSERT INTO entries
      (feedId, entryId, title, link, author, published, updated,
       description, thumbnail, content)
      SELECT f.id, json_extract(j.value, '$.entryId'),
        COALESCE(json_extract(j.value, '$.title'), ''),
        COALESCE(json_extract(j.value, '$.link'), ''),
        COALESCE(json_extract(j.value, '$.author'), ''),
        COALESCE(json_extract(j.value, '$.published'), ''),
        json_extract(j.value, '$.updated'),
        COALESCE(json_extract(j.value, '$.description'), ''),
        json_extract(j.value, '$.thumbnail'), json_extract(j.value, '$.content')
      FROM json_each(?) AS j
      JOIN feeds f ON f.link = json_extract(j.value, '$.feedLink') WHERE 1
      ON CONFLICT(feedId, entryId) DO UPDATE SET
        title = excluded.title, link = excluded.link,
        author = excluded.author, published = excluded.published,
        updated = excluded.updated, description = excluded.description,
        thumbnail = excluded.thumbnail, content = excluded.content`
      )
      .bind(entryJson),
    db
      .prepare(
        `INSERT OR IGNORE INTO UserFeeds (userId, feedId, createdAt)
      SELECT ?, f.id, ? FROM json_each(?) AS j
      JOIN feeds f ON f.link = json_extract(j.value, '$.link')`
      )
      .bind(userId, new Date().toISOString(), feedJson),
  ]);
}

const editableFeedFields = [
  "titleOverride",
  "descriptionOverride",
  "authorOverride",
  "imageOverride",
  "linkOverride",
  "refreshIntervalMins",
] as const;

export async function updateFeed(
  db: D1Database,
  userId: string,
  id: number,
  data: Record<string, unknown>
): Promise<FeedWithEntries | null> {
  if (!(await readFeed(db, userId, id))) return null;
  if ("refreshIntervalMins" in data) {
    const value = data.refreshIntervalMins;
    if (
      value !== null &&
      !(typeof value === "number" && Number.isInteger(value) && value > 0)
    ) {
      throw new InputError(
        "refreshIntervalMins must be null or a positive integer"
      );
    }
  }
  const overrides = Object.fromEntries(
    (["title", "description", "author", "image", "link"] as const)
      .filter(key => key in data)
      .map(key => [`${key}Override`, data[key]])
  );
  if ("refreshIntervalMins" in data)
    overrides.refreshIntervalMins = data.refreshIntervalMins;
  for (const value of Object.values(overrides)) {
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number"
    )
      throw new InputError("Invalid feed field");
  }
  const fields = editableFeedFields.filter(key => key in overrides);
  if (fields.length > 0) {
    const values = fields.map(key => overrides[key]);
    await db
      .prepare(
        `UPDATE UserFeeds SET ${fields.map(key => `${key} = ?`).join(", ")} WHERE userId = ? AND feedId = ?`
      )
      .bind(...values, userId, id)
      .run();
  }
  return readFeed(db, userId, id);
}

export async function updateEntry(
  db: D1Database,
  userId: string,
  feedId: number,
  entryId: string,
  data: Record<string, unknown>
): Promise<EntryRow | null> {
  const fields = (["openedAt", "archivedAt", "starredAt"] as const).filter(
    key => key in data
  );
  const existing = await db
    .prepare(
      `SELECT e.id FROM entries e JOIN UserFeeds uf
    ON uf.feedId = e.feedId WHERE uf.userId = ? AND e.feedId = ? AND e.entryId = ?`
    )
    .bind(userId, feedId, entryId)
    .first<{ id: number }>();
  if (!existing) return null;
  if (fields.length > 0) {
    for (const field of fields) {
      if (data[field] !== null && typeof data[field] !== "string")
        throw new InputError(`${field} must be a string or null`);
    }
    const values = fields.map(key => data[key]);
    await db
      .prepare(
        `INSERT INTO UserEntryStates (userId, entryId, ${fields.join(", ")})
         VALUES (?, ?, ${fields.map(() => "?").join(", ")})
         ON CONFLICT(userId, entryId) DO UPDATE SET ${fields.map(key => `${key} = excluded.${key}`).join(", ")}`
      )
      .bind(userId, existing.id, ...values)
      .run();
  }
  return db
    .prepare(
      `SELECT e.id, e.feedId, e.entryId, e.title, e.link, e.author,
      e.published, e.updated, e.description, e.thumbnail, e.content,
      s.openedAt, s.archivedAt, s.starredAt FROM entries e
      LEFT JOIN UserEntryStates s ON s.entryId = e.id AND s.userId = ?
      WHERE e.id = ?`
    )
    .bind(userId, existing.id)
    .first<EntryRow>();
}

export class InputError extends Error {}

export class FeedFetchError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function normalizeTagName(input: unknown): string {
  if (typeof input !== "string")
    throw new InputError("Tag name must be a string");
  const name = input.trim().toLowerCase();
  if (!name) throw new InputError("Tag name cannot be empty");
  if (name.length > 32)
    throw new InputError("Tag name cannot exceed 32 characters");
  return name;
}

export async function createTag(
  db: D1Database,
  userId: string,
  input: unknown
): Promise<TagRow> {
  const name = normalizeTagName(input);
  await db
    .prepare("INSERT OR IGNORE INTO UserTags (userId, name) VALUES (?, ?)")
    .bind(userId, name)
    .run();
  const row = await db
    .prepare("SELECT id, name FROM UserTags WHERE userId = ? AND name = ?")
    .bind(userId, name)
    .first<TagRow>();
  if (!row) throw new Error("Tag was not saved");
  return row;
}

export async function refreshStoredFeed(
  db: D1Database,
  id: number
): Promise<boolean> {
  const row = await db
    .prepare("SELECT feedUrl, link FROM feeds WHERE id = ?")
    .bind(id)
    .first<Pick<FeedRow, "feedUrl" | "link">>();
  if (!row) return false;
  const result = await fetchFeed(row.feedUrl || row.link);
  if (result.error)
    throw new FeedFetchError(result.error.code, result.error.message);
  await upsertFeed(db, result.data);
  return true;
}

export async function refreshDueFeeds(db: D1Database): Promise<void> {
  const { results } = await db
    .prepare(
      `SELECT f.id FROM feeds f JOIN UserFeeds uf ON uf.feedId = f.id
    WHERE uf.refreshIntervalMins IS NOT NULL AND
    (fetchedAt IS NULL OR strftime('%s', fetchedAt) IS NULL OR
      (unixepoch('now') - unixepoch(fetchedAt)) >= uf.refreshIntervalMins * 60)
    GROUP BY f.id`
    )
    .all<{ id: number }>();
  for (const { id } of results) {
    try {
      await refreshStoredFeed(db, id);
    } catch (error) {
      console.error("background_refresh_failed", id, error);
    }
  }
}
