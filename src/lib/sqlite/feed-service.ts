import type { Feed, FeedEntry } from '../feed';
import { getDB } from './sqlite';

export async function upsertFeed(feed: Feed): Promise<number> {
  const { promiser, dbId } = getDB();

  await promiser('exec', {
    dbId,
    sql: `INSERT INTO feeds (title, description, link, author, published, image)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(link) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            author = excluded.author,
            published = excluded.published,
            image = excluded.image`,
    bind: [feed.title, feed.description, feed.link, feed.author, feed.published, feed.image ?? null],
  });

  const idResult = await promiser('exec', {
    dbId,
    sql: 'SELECT id FROM feeds WHERE link = ?',
    bind: [feed.link],
    returnValue: 'resultRows',
    rowMode: 'object',
  });

  const feedId = idResult.result.resultRows[0].id as number;

  for (const entry of feed.entries) {
    await upsertEntry(feedId, entry);
  }

  return feedId;
}

export async function upsertEntry(feedId: number, entry: FeedEntry): Promise<void> {
  const { promiser, dbId } = getDB();

  await promiser('exec', {
    dbId,
    sql: `INSERT INTO entries (feedId, entryId, title, link, author, published, updated, description, thumbnail, content)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(feedId, entryId) DO UPDATE SET
            title = excluded.title,
            link = excluded.link,
            author = excluded.author,
            published = excluded.published,
            updated = excluded.updated,
            description = excluded.description,
            thumbnail = excluded.thumbnail,
            content = excluded.content`,
    bind: [
      feedId,
      entry.id,
      entry.title,
      entry.link,
      entry.author,
      entry.published,
      entry.updated ?? null,
      entry.description,
      entry.thumbnail ?? null,
      entry.content ?? null,
    ],
  });
}

export async function getAllFeeds(): Promise<Feed[]> {
  const { promiser, dbId } = getDB();

  const feedRows = await promiser('exec', {
    dbId,
    sql: 'SELECT * FROM feeds ORDER BY id',
    returnValue: 'resultRows',
    rowMode: 'object',
  });

  const feeds: Feed[] = [];

  for (const row of feedRows.result.resultRows) {
    const entryRows = await promiser('exec', {
      dbId,
      sql: 'SELECT * FROM entries WHERE feedId = ? ORDER BY published DESC',
      bind: [row.id as number],
      returnValue: 'resultRows',
      rowMode: 'object',
    });

    const entries: FeedEntry[] = entryRows.result.resultRows.map((e) => ({
      id: e.entryId as string,
      title: e.title as string,
      link: e.link as string,
      author: e.author as string,
      published: e.published as string,
      updated: (e.updated as string) ?? undefined,
      description: e.description as string,
      thumbnail: (e.thumbnail as string) ?? undefined,
      content: (e.content as string) ?? undefined,
    }));

    feeds.push({
      title: row.title as string,
      description: row.description as string,
      link: row.link as string,
      author: row.author as string,
      published: row.published as string,
      image: (row.image as string) ?? undefined,
      entries,
    });
  }

  return feeds;
}

export async function deleteFeed(feedId: number): Promise<void> {
  const { promiser, dbId } = getDB();

  await promiser('exec', {
    dbId,
    sql: 'DELETE FROM feeds WHERE id = ?',
    bind: [feedId],
  });
}
