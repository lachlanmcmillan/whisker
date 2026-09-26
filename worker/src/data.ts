import {
  fetchFeed,
  type Feed as ParsedFeed,
} from "../../server/src/lib/feed/fetch";

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

export async function readFeeds(db: D1Database): Promise<FeedWithEntries[]> {
  const { results: feedRows } = await db
    .prepare("SELECT * FROM feeds ORDER BY id")
    .all<FeedRow>();
  if (feedRows.length === 0) return [];

  const [entries, tagged] = await Promise.all([
    db.prepare("SELECT * FROM entries ORDER BY published DESC").all<EntryRow>(),
    db
      .prepare(
        `SELECT ft.feedId, t.id, t.name FROM FeedTags ft
      JOIN Tags t ON t.id = ft.tagId ORDER BY t.id`
      )
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
  id: number
): Promise<FeedWithEntries | null> {
  const row = await db
    .prepare("SELECT * FROM feeds WHERE id = ?")
    .bind(id)
    .first<FeedRow>();
  if (!row) return null;
  const [entries, tags] = await Promise.all([
    db
      .prepare("SELECT * FROM entries WHERE feedId = ? ORDER BY published DESC")
      .bind(id)
      .all<EntryRow>(),
    readFeedTags(db, id),
  ]);
  return { ...row, entries: entries.results, tags };
}

export async function readFeedTags(
  db: D1Database,
  id: number
): Promise<TagRow[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id, t.name FROM Tags t
    JOIN FeedTags ft ON ft.tagId = t.id WHERE ft.feedId = ? ORDER BY t.id`
    )
    .bind(id)
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

const editableFeedFields = [
  "title",
  "description",
  "author",
  "image",
  "link",
  "feedUrl",
  "refreshIntervalMins",
] as const;

export async function updateFeed(
  db: D1Database,
  id: number,
  data: Record<string, unknown>
): Promise<FeedWithEntries | null> {
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
  const fields = editableFeedFields.filter(key => key in data);
  if (fields.length > 0) {
    const values = fields.map(key => data[key]);
    await db
      .prepare(
        `UPDATE feeds SET ${fields.map(key => `${key} = ?`).join(", ")} WHERE id = ?`
      )
      .bind(...values, id)
      .run();
  }
  return readFeed(db, id);
}

export async function updateEntry(
  db: D1Database,
  feedId: number,
  entryId: string,
  data: Record<string, unknown>
): Promise<EntryRow | null> {
  const fields = (["openedAt", "archivedAt", "starredAt"] as const).filter(
    key => key in data
  );
  if (fields.length > 0) {
    const values = fields.map(key => data[key]);
    await db
      .prepare(
        `UPDATE entries SET ${fields.map(key => `${key} = ?`).join(", ")} WHERE feedId = ? AND entryId = ?`
      )
      .bind(...values, feedId, entryId)
      .run();
  }
  return db
    .prepare("SELECT * FROM entries WHERE feedId = ? AND entryId = ?")
    .bind(feedId, entryId)
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
  input: unknown
): Promise<TagRow> {
  const name = normalizeTagName(input);
  await db
    .prepare("INSERT OR IGNORE INTO Tags (name) VALUES (?)")
    .bind(name)
    .run();
  const row = await db
    .prepare("SELECT id, name FROM Tags WHERE name = ?")
    .bind(name)
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
      `SELECT id FROM feeds
    WHERE refreshIntervalMins IS NOT NULL AND
    (fetchedAt IS NULL OR strftime('%s', fetchedAt) IS NULL OR
      (unixepoch('now') - unixepoch(fetchedAt)) >= refreshIntervalMins * 60)`
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
