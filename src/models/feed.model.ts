import { sql } from "../lib/sqlite/sqlite";
import { ok, type AsyncResult } from "../lib/result";

export interface FeedEntry {
  entryId: string;
  feedId?: number;
  title: string;
  link: string;
  author: string;
  published: string;
  updated?: string;
  description: string;
  thumbnail?: string;
  content?: string;
  openedAt?: string;
}

export interface Feed {
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  author: string;
  published: string;
  image?: string;
  fetchedAt?: string;
  entries: FeedEntry[];
}

export async function upsertFeed(feed: Feed): AsyncResult<number> {
  const insertResult = await sql`INSERT INTO feeds (title, description, link, feedUrl, author, published, image, fetchedAt)
    VALUES (${feed.title}, ${feed.description}, ${feed.link}, ${feed.feedUrl}, ${feed.author}, ${feed.published}, ${feed.image ?? null}, ${feed.fetchedAt ?? null})
    ON CONFLICT(link) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      feedUrl = excluded.feedUrl,
      author = excluded.author,
      published = excluded.published,
      image = excluded.image,
      fetchedAt = excluded.fetchedAt`;
  if (insertResult.error) return insertResult;

  const idResult = await sql<{ id: number }>`SELECT id FROM feeds WHERE link = ${feed.link}`;
  if (idResult.error) return idResult;

  const feedId = idResult.data[0].id;

  for (const entry of feed.entries) {
    const entryResult = await upsertEntry(feedId, entry);
    if (entryResult.error) return entryResult;
  }

  return ok(feedId);
}

async function upsertEntry(feedId: number, entry: FeedEntry): AsyncResult<void> {
  const result = await sql`
    INSERT INTO entries (feedId, entryId, title, link, author, published, updated, description, thumbnail, content)
         VALUES (${feedId}, ${entry.entryId}, ${entry.title}, ${entry.link}, ${entry.author}, ${entry.published}, ${entry.updated ?? null}, ${entry.description}, ${entry.thumbnail ?? null}, ${entry.content ?? null})
             ON CONFLICT(feedId, entryId) DO UPDATE SET
      title = excluded.title,
      link = excluded.link,
      author = excluded.author,
      published = excluded.published,
      updated = excluded.updated,
      description = excluded.description,
      thumbnail = excluded.thumbnail,
      content = excluded.content`;
  if (result.error) return result;

  return ok(undefined);
}

interface FeedRow {
  id: number;
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  author: string;
  published: string;
  image: string | null;
  fetchedAt: string | null;
}

interface EntryRow {
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
}

function toFeedEntry(e: EntryRow): FeedEntry {
  return {
    feedId: e.feedId,
    entryId: e.entryId,
    title: e.title,
    link: e.link,
    author: e.author,
    published: e.published,
    updated: e.updated ?? undefined,
    description: e.description,
    thumbnail: e.thumbnail ?? undefined,
    content: e.content ?? undefined,
    openedAt: e.openedAt ?? undefined,
  };
}

function toFeed(row: FeedRow, entryRows: EntryRow[]): Feed {
  return {
    title: row.title,
    description: row.description,
    link: row.link,
    feedUrl: row.feedUrl,
    author: row.author,
    published: row.published,
    image: row.image ?? undefined,
    fetchedAt: row.fetchedAt ?? undefined,
    entries: entryRows.map(toFeedEntry),
  };
}

export async function readAllFeeds(): AsyncResult<Feed[]> {
  const feedResult = await sql<FeedRow>`
      SELECT *
        FROM feeds
    ORDER BY id
  `;
  if (feedResult.error) return feedResult;

  const feeds: Feed[] = [];

  for (const row of feedResult.data) {
    const entryResult = await sql<EntryRow>`
        SELECT *
          FROM entries
         WHERE feedId = ${row.id}
      ORDER BY published DESC
    `;
    if (entryResult.error) return entryResult;

    feeds.push(toFeed(row, entryResult.data));
  }

  return ok(feeds);
}

export async function readFeedByLink(link: string): AsyncResult<Feed | null> {
  const feedResult = await sql<FeedRow>`SELECT * FROM feeds WHERE link = ${link}`;
  if (feedResult.error) return feedResult;
  if (feedResult.data.length === 0) return ok(null);

  const row = feedResult.data[0];
  const entryResult = await sql<EntryRow>`
      SELECT *
        FROM entries
       WHERE feedId = ${row.id}
    ORDER BY published DESC
  `;
  if (entryResult.error) return entryResult;

  return ok(toFeed(row, entryResult.data));
}

export async function deleteFeed(feedId: number): AsyncResult<void> {
  const result = await sql`
    DELETE
      FROM feeds
     WHERE id = ${feedId}
  `;
  if (result.error) return result;

  return ok(undefined);
}

export async function markEntryOpened(feedId: number, entryId: string): AsyncResult<void> {
  const result = await sql`
    UPDATE entries
       SET openedAt = ${new Date().toISOString()}
     WHERE feedId = ${feedId}
       AND entryId = ${entryId}
  `;
  if (result.error) return result;

  return ok(undefined);
}
