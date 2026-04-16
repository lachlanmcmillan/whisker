import { db } from "../db";
import type { entriesModel } from "../generated/prisma/models/entries";
import type { feedsModel } from "../generated/prisma/models/feeds";
import type { Feed } from "../lib/feed/fetch";
import { ok, err, type Result } from "@whisker/common";

type EntryRow = entriesModel;
type FeedRow = feedsModel;
type FeedWithEntries = FeedRow & { entries: EntryRow[] };

function readAll() {
  try {
    const feedRows = db
      .query<FeedRow, []>("SELECT * FROM feeds ORDER BY id")
      .all();

    const result = feedRows.map(row => {
      const entryRows = db
        .query<
          EntryRow,
          [number]
        >("SELECT * FROM entries WHERE feedId = ? ORDER BY published DESC")
        .all(row.id);

      return { ...row, entries: entryRows };
    });

    return ok(result);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "feeds.readAll",
    });
  }
}

function readWithEntriesById(id: number): Result<FeedWithEntries | null> {
  try {
    const row = db
      .query<FeedRow, [number]>("SELECT * FROM feeds WHERE id = ?")
      .get(id);

    if (!row) return ok(null);

    const entries = db
      .query<
        EntryRow,
        [number]
      >("SELECT * FROM entries WHERE feedId = ? ORDER BY published DESC")
      .all(id);

    return ok({ ...row, entries });
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "feeds.readWithEntriesById",
      feedId: id,
    });
  }
}

function readAllRows(): Result<FeedRow[]> {
  try {
    const rows = db.query<FeedRow, []>("SELECT * FROM feeds ORDER BY id").all();
    return ok(rows);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "feeds.readAllRows",
    });
  }
}

function readById(id: number): Result<FeedRow | null> {
  try {
    const row = db
      .query<FeedRow, [number]>("SELECT * FROM feeds WHERE id = ?")
      .get(id);
    return ok(row ?? null);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "feeds.readById",
      feedId: id,
    });
  }
}

function readEntryById(
  feedId: number,
  entryId: string
): Result<EntryRow | null> {
  try {
    const row = db
      .query<
        EntryRow,
        [number, string]
      >("SELECT * FROM entries WHERE feedId = ? AND entryId = ?")
      .get(feedId, entryId);
    return ok(row ?? null);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "feeds.readEntryById",
      feedId,
      entryId,
    });
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
      feed.fetchedAt ?? null
    );

    const feedRow = db
      .query<{ id: number }, [string]>("SELECT id FROM feeds WHERE link = ?")
      .get(feed.link);
    if (!feedRow) {
      return err("db_query_failed", "Failed to upsert feed", {
        operation: "feeds.upsert",
        feedLink: feed.link,
        feedUrl: feed.feedUrl,
        title: feed.title,
      });
    }

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
        entry.content ?? null
      );
    }

    return ok(feedRow.id);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "feeds.upsert",
      feedLink: feed.link,
      feedUrl: feed.feedUrl,
      title: feed.title,
    });
  }
}

function remove(id: number): Result<void> {
  try {
    db.query("DELETE FROM feeds WHERE id = ?").run(id);
    return ok(undefined);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "feeds.remove",
      feedId: id,
    });
  }
}

type FeedUpdate = Partial<
  Pick<
    FeedRow,
    | "title"
    | "description"
    | "author"
    | "image"
    | "link"
    | "feedUrl"
    | "refreshIntervalMins"
  >
>;

function update(id: number, data: FeedUpdate): Result<FeedWithEntries> {
  try {
    if ("refreshIntervalMins" in data) {
      const interval = data.refreshIntervalMins;
      const isValidInterval =
        interval === null ||
        (typeof interval === "number" &&
          Number.isInteger(interval) &&
          interval > 0);

      if (!isValidInterval) {
        return err(
          "invalid_input",
          "refreshIntervalMins must be null or a positive integer",
          {
            operation: "feeds.update",
            feedId: id,
            refreshIntervalMins: interval,
          }
        );
      }
    }

    const allowedKeys = [
      "title",
      "description",
      "author",
      "image",
      "link",
      "feedUrl",
      "refreshIntervalMins",
    ];
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedKeys.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(value ?? null);
      }
    }

    if (setClauses.length > 0) {
      values.push(id);
      db.query(`UPDATE feeds SET ${setClauses.join(", ")} WHERE id = ?`).run(
        ...values
      );
    }

    const feedResult = readWithEntriesById(id);
    if (feedResult.error) return feedResult;
    if (!feedResult.data) {
      return err("feed_not_found", "Feed not found", {
        operation: "feeds.update",
        feedId: id,
      });
    }

    return ok(feedResult.data);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "feeds.update",
      feedId: id,
      data,
    });
  }
}

type EntryUpdate = Partial<
  Pick<EntryRow, "openedAt" | "archivedAt" | "starredAt">
>;

function updateEntry(
  feedId: number,
  entryId: string,
  data: EntryUpdate
): Result<EntryRow> {
  try {
    const setClauses: string[] = [];
    const values: (string | null)[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (["openedAt", "archivedAt", "starredAt"].includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(value ?? null);
      }
    }

    if (setClauses.length > 0) {
      values.push(String(feedId), entryId);
      db.query(
        `UPDATE entries SET ${setClauses.join(", ")} WHERE feedId = ? AND entryId = ?`
      ).run(...values);
    }

    const entryResult = readEntryById(feedId, entryId);
    if (entryResult.error) return entryResult;
    if (!entryResult.data) {
      return err("entry_not_found", "Entry not found", {
        operation: "feeds.updateEntry",
        feedId,
        entryId,
      });
    }

    return ok(entryResult.data);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "feeds.updateEntry",
      feedId,
      entryId,
      data,
    });
  }
}

export const feeds = {
  readAll,
  readAllRows,
  readById,
  readWithEntriesById,
  upsert,
  update,
  remove,
  updateEntry,
};
