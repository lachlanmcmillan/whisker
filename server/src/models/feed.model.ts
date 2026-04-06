import { db } from "../db";
import type { Feed, FeedEntry } from "../lib/types";
import { ok, err, type Result } from "@whisker/common";

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
}

function toFeedEntry(e: EntryRow): FeedEntry & { feedId: number; openedAt?: string } {
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

export function readAllFeeds(): Result<(Feed & { id: number })[]> {
  try {
    const feedRows = db
      .query<FeedRow, []>("SELECT * FROM feeds ORDER BY id")
      .all();

    const feeds = feedRows.map((row) => {
      const entryRows = db
        .query<EntryRow, [number]>(
          "SELECT * FROM entries WHERE feedId = ? ORDER BY published DESC"
        )
        .all(row.id);

      return {
        id: row.id,
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
    });

    return ok(feeds);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

export function readFeedById(id: number): Result<FeedRow | null> {
  try {
    const row = db
      .query<FeedRow, [number]>("SELECT * FROM feeds WHERE id = ?")
      .get(id);
    return ok(row ?? null);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

export function upsertFeed(feed: Feed): Result<number> {
  try {
    db.query(`
      INSERT INTO feeds (title, description, link, feedUrl, author, published, image, fetchedAt)
      VALUES ($title, $description, $link, $feedUrl, $author, $published, $image, $fetchedAt)
      ON CONFLICT(link) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        feedUrl = excluded.feedUrl,
        author = excluded.author,
        published = excluded.published,
        image = excluded.image,
        fetchedAt = excluded.fetchedAt
    `).run({
      $title: feed.title,
      $description: feed.description,
      $link: feed.link,
      $feedUrl: feed.feedUrl,
      $author: feed.author,
      $published: feed.published,
      $image: feed.image ?? null,
      $fetchedAt: feed.fetchedAt ?? null,
    });

    const feedRow = db
      .query<{ id: number }, [string]>("SELECT id FROM feeds WHERE link = ?")
      .get(feed.link);
    if (!feedRow) return err("db_query_failed", "Failed to upsert feed");

    const upsertEntryStmt = db.query(`
      INSERT INTO entries (feedId, entryId, title, link, author, published, updated, description, thumbnail, content)
      VALUES ($feedId, $entryId, $title, $link, $author, $published, $updated, $description, $thumbnail, $content)
      ON CONFLICT(feedId, entryId) DO UPDATE SET
        title = excluded.title,
        link = excluded.link,
        author = excluded.author,
        published = excluded.published,
        updated = excluded.updated,
        description = excluded.description,
        thumbnail = excluded.thumbnail,
        content = excluded.content
    `);

    for (const entry of feed.entries) {
      upsertEntryStmt.run({
        $feedId: feedRow.id,
        $entryId: entry.entryId,
        $title: entry.title,
        $link: entry.link,
        $author: entry.author,
        $published: entry.published,
        $updated: entry.updated ?? null,
        $description: entry.description,
        $thumbnail: entry.thumbnail ?? null,
        $content: entry.content ?? null,
      });
    }

    return ok(feedRow.id);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

export function deleteFeed(id: number): Result<void> {
  try {
    db.run("DELETE FROM feeds WHERE id = ?", [id]);
    return ok(undefined);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

export function updateEntryOpenedAt(
  feedId: number,
  entryId: string,
  openedAt: string | null
): Result<void> {
  try {
    db.run(
      "UPDATE entries SET openedAt = ? WHERE feedId = ? AND entryId = ?",
      [openedAt, feedId, entryId]
    );
    return ok(undefined);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}
