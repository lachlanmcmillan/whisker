import { sql } from "../lib/sqlite/sqlite";

export interface FeedEntry {
  id: string;
  title: string;
  link: string;
  author: string;
  published: string;
  updated?: string;
  description: string;
  thumbnail?: string;
  content?: string;
}

export interface Feed {
  title: string;
  description: string;
  link: string;
  author: string;
  published: string;
  image?: string;
  entries: FeedEntry[];
}

export async function upsertFeed(feed: Feed): Promise<number> {
  await sql`INSERT INTO feeds (title, description, link, author, published, image)
    VALUES (${feed.title}, ${feed.description}, ${feed.link}, ${feed.author}, ${feed.published}, ${feed.image ?? null})
    ON CONFLICT(link) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      author = excluded.author,
      published = excluded.published,
      image = excluded.image`;

  const rows = await sql<{
    id: number;
  }>`SELECT id FROM feeds WHERE link = ${feed.link}`;
  const feedId = rows[0].id;

  for (const entry of feed.entries) {
    await upsertEntry(feedId, entry);
  }

  return feedId;
}

async function upsertEntry(feedId: number, entry: FeedEntry): Promise<void> {
  await sql`
    INSERT INTO entries (feedId, entryId, title, link, author, published, updated, description, thumbnail, content)
         VALUES (${feedId}, ${entry.id}, ${entry.title}, ${entry.link}, ${entry.author}, ${entry.published}, ${entry.updated ?? null}, ${entry.description}, ${entry.thumbnail ?? null}, ${entry.content ?? null})
             ON CONFLICT(feedId, entryId) DO UPDATE SET
      title = excluded.title,
      link = excluded.link,
      author = excluded.author,
      published = excluded.published,
      updated = excluded.updated,
      description = excluded.description,
      thumbnail = excluded.thumbnail,
      content = excluded.content`;
}

interface FeedRow {
  id: number;
  title: string;
  description: string;
  link: string;
  author: string;
  published: string;
  image: string | null;
}

interface EntryRow {
  entryId: string;
  title: string;
  link: string;
  author: string;
  published: string;
  updated: string | null;
  description: string;
  thumbnail: string | null;
  content: string | null;
}

export async function readAllFeeds(): Promise<Feed[]> {
  const feedRows = await sql<FeedRow>`
      SELECT * 
        FROM feeds 
    ORDER BY id
  `;

  const feeds: Feed[] = [];

  for (const row of feedRows) {
    const entryRows = await sql<EntryRow>`
        SELECT * 
          FROM entries 
         WHERE feedId = ${row.id} 
      ORDER BY published DESC
    `;

    const entries: FeedEntry[] = entryRows.map((e) => ({
      id: e.entryId,
      title: e.title,
      link: e.link,
      author: e.author,
      published: e.published,
      updated: e.updated ?? undefined,
      description: e.description,
      thumbnail: e.thumbnail ?? undefined,
      content: e.content ?? undefined,
    }));

    feeds.push({
      title: row.title,
      description: row.description,
      link: row.link,
      author: row.author,
      published: row.published,
      image: row.image ?? undefined,
      entries,
    });
  }

  return feeds;
}

export async function deleteFeed(feedId: number): Promise<void> {
  await sql`
    DELETE 
      FROM feeds 
     WHERE id = ${feedId}
  `;
}
