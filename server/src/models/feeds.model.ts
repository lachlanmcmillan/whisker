import { db } from "../db";
import type { entriesModel } from "../generated/prisma/models";
import type { Feed } from "../lib/types";
import { ok, err, type Result } from "@whisker/common";

type EntryRow = entriesModel;
type FeedRow = {
  id: number;
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  author: string;
  published: string;
  image: string | null;
  fetchedAt: string | null;
};

function readAll() {
  try {
    const feedRows = db.query<FeedRow, []>(
      "SELECT * FROM feeds ORDER BY id"
    ).all();

    const result = feedRows.map((row) => {
      const entryRows = db.query<EntryRow, [number]>(
        "SELECT * FROM entries WHERE feedId = ? ORDER BY published DESC"
      ).all(row.id);

      return { ...row, entries: entryRows };
    });

    return ok(result);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

function readById(id: number): Result<FeedRow | null> {
  try {
    const row = db.query<FeedRow, [number]>(
      "SELECT * FROM feeds WHERE id = ?"
    ).get(id);
    return ok(row ?? null);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

function upsert(feed: Feed): Result<number> {
  try {
    db.query(
      `INSERT INTO feeds (title, description, link, feedUrl, author, published, image, fetchedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(link) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         feedUrl = excluded.feedUrl,
         author = excluded.author,
         published = excluded.published,
         image = excluded.image,
         fetchedAt = excluded.fetchedAt`
    ).run(
      feed.title,
      feed.description,
      feed.link,
      feed.feedUrl,
      feed.author,
      feed.published,
      feed.image ?? null,
      feed.fetchedAt ?? null,
    );

    const feedRow = db.query<{ id: number }, [string]>(
      "SELECT id FROM feeds WHERE link = ?"
    ).get(feed.link);
    if (!feedRow) return err("db_query_failed", "Failed to upsert feed");

    for (const entry of feed.entries) {
      db.query(
        `INSERT INTO entries (feedId, entryId, title, link, author, published, updated, description, thumbnail, content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(feedId, entryId) DO UPDATE SET
           title = excluded.title,
           link = excluded.link,
           author = excluded.author,
           published = excluded.published,
           updated = excluded.updated,
           description = excluded.description,
           thumbnail = excluded.thumbnail,
           content = excluded.content`
      ).run(
        feedRow.id,
        entry.entryId,
        entry.title,
        entry.link,
        entry.author,
        entry.published,
        entry.updated ?? null,
        entry.description,
        entry.thumbnail ?? null,
        entry.content ?? null,
      );
    }

    return ok(feedRow.id);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

function remove(id: number): Result<void> {
  try {
    db.query("DELETE FROM feeds WHERE id = ?").run(id);
    return ok(undefined);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e));
  }
}

type EntryUpdate = Partial<Pick<EntryRow, "openedAt" | "archivedAt" | "starredAt">>;

function updateEntry(
  feedId: number,
  entryId: string,
  data: EntryUpdate
): Result<void> {
  try {
    const setClauses: string[] = [];
    const values: (string | null)[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (["openedAt", "archivedAt", "starredAt"].includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(value ?? null);
      }
    }

    if (setClauses.length === 0) return ok(undefined);

    values.push(String(feedId), entryId);
    db.query(
      `UPDATE entries SET ${setClauses.join(", ")} WHERE feedId = ? AND entryId = ?`
    ).run(...values);

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
