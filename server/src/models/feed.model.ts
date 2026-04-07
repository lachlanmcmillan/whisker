import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { feeds, entries } from "../db/schema";
import type { Feed } from "../lib/types";
import { ok, err, type Result } from "@whisker/common";

export function readAllFeeds(): Result<(Feed & { id: number })[]> {
  try {
    const feedRows = db.select().from(feeds).orderBy(feeds.id).all();

    const result = feedRows.map((row) => {
      const entryRows = db
        .select()
        .from(entries)
        .where(eq(entries.feedId, row.id))
        .orderBy(entries.published)
        .all()
        .reverse();

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
        entries: entryRows.map((e) => ({
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
        })),
      };
    });

    return ok(result);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

export function readFeedById(
  id: number
): Result<typeof feeds.$inferSelect | null> {
  try {
    const row = db
      .select()
      .from(feeds)
      .where(eq(feeds.id, id))
      .get();
    return ok(row ?? null);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

export function upsertFeed(feed: Feed): Result<number> {
  try {
    db.insert(feeds)
      .values({
        title: feed.title,
        description: feed.description,
        link: feed.link,
        feedUrl: feed.feedUrl,
        author: feed.author,
        published: feed.published,
        image: feed.image ?? null,
        fetchedAt: feed.fetchedAt ?? null,
      })
      .onConflictDoUpdate({
        target: feeds.link,
        set: {
          title: feed.title,
          description: feed.description,
          feedUrl: feed.feedUrl,
          author: feed.author,
          published: feed.published,
          image: feed.image ?? null,
          fetchedAt: feed.fetchedAt ?? null,
        },
      })
      .run();

    const feedRow = db
      .select({ id: feeds.id })
      .from(feeds)
      .where(eq(feeds.link, feed.link))
      .get();
    if (!feedRow) return err("db_query_failed", "Failed to upsert feed");

    for (const entry of feed.entries) {
      db.insert(entries)
        .values({
          feedId: feedRow.id,
          entryId: entry.entryId,
          title: entry.title,
          link: entry.link,
          author: entry.author,
          published: entry.published,
          updated: entry.updated ?? null,
          description: entry.description,
          thumbnail: entry.thumbnail ?? null,
          content: entry.content ?? null,
        })
        .onConflictDoUpdate({
          target: [entries.feedId, entries.entryId],
          set: {
            title: entry.title,
            link: entry.link,
            author: entry.author,
            published: entry.published,
            updated: entry.updated ?? null,
            description: entry.description,
            thumbnail: entry.thumbnail ?? null,
            content: entry.content ?? null,
          },
        })
        .run();
    }

    return ok(feedRow.id);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

export function deleteFeed(id: number): Result<void> {
  try {
    db.delete(feeds).where(eq(feeds.id, id)).run();
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
    db.update(entries)
      .set({ openedAt })
      .where(and(eq(entries.feedId, feedId), eq(entries.entryId, entryId)))
      .run();
    return ok(undefined);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}
