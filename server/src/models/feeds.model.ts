import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { feeds as feedsTable, entries } from "../db/schema";
import type { Feed } from "../lib/types";
import { ok, err, type Result } from "@whisker/common";

function readAll() {
  try {
    const feedRows = db.select().from(feedsTable).orderBy(feedsTable.id).all();

    const result = feedRows.map((row) => {
      const entryRows = db
        .select()
        .from(entries)
        .where(eq(entries.feedId, row.id))
        .orderBy(entries.published)
        .all()
        .reverse();

      return { ...row, entries: entryRows };
    });

    return ok(result);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

function readById(
  id: number
): Result<typeof feedsTable.$inferSelect | null> {
  try {
    const row = db
      .select()
      .from(feedsTable)
      .where(eq(feedsTable.id, id))
      .get();
    return ok(row ?? null);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

function upsert(feed: Feed): Result<number> {
  try {
    db.insert(feedsTable)
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
        target: feedsTable.link,
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
      .select({ id: feedsTable.id })
      .from(feedsTable)
      .where(eq(feedsTable.link, feed.link))
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

function remove(id: number): Result<void> {
  try {
    db.delete(feedsTable).where(eq(feedsTable.id, id)).run();
    return ok(undefined);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

type EntryUpdate = Partial<Pick<typeof entries.$inferSelect, "openedAt" | "archivedAt" | "starredAt">>;

function updateEntry(
  feedId: number,
  entryId: string,
  data: EntryUpdate
): Result<void> {
  try {
    db.update(entries)
      .set(data)
      .where(and(eq(entries.feedId, feedId), eq(entries.entryId, entryId)))
      .run();
    return ok(undefined);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

export const feeds = {
  readAll,
  readById,
  upsert,
  remove,
  updateEntry,
};
