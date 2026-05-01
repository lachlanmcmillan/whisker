import { ok, err, type Result } from "@whisker/common";
import { db } from "../db";

export type TagRow = {
  id: number;
  name: string;
};

const MAX_NAME_LENGTH = 32;

function normalizeName(input: unknown): Result<string> {
  if (typeof input !== "string") {
    return err("invalid_input", "Tag name must be a string");
  }
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) {
    return err("invalid_input", "Tag name cannot be empty");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return err(
      "invalid_input",
      `Tag name cannot exceed ${MAX_NAME_LENGTH} characters`
    );
  }
  return ok(trimmed);
}

function readAll(): Result<TagRow[]> {
  return db.safeQuery<TagRow>("SELECT id, name FROM Tags ORDER BY name ASC");
}

function readById(id: number): Result<TagRow | null> {
  try {
    const row = db
      .query<TagRow, [number]>("SELECT id, name FROM Tags WHERE id = ?")
      .get(id);
    return ok(row ?? null);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "tags.readById",
      id,
    });
  }
}

function readByName(name: string): Result<TagRow | null> {
  try {
    const row = db
      .query<TagRow, [string]>("SELECT id, name FROM Tags WHERE name = ?")
      .get(name);
    return ok(row ?? null);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "tags.readByName",
      name,
    });
  }
}

function create(name: string): Result<TagRow> {
  const normalized = normalizeName(name);
  if (normalized.error) return normalized;

  try {
    const existing = db
      .query<TagRow, [string]>("SELECT id, name FROM Tags WHERE name = ?")
      .get(normalized.data);
    if (existing) return ok(existing);

    const inserted = db
      .query<
        TagRow,
        [string]
      >("INSERT INTO Tags (name) VALUES (?) RETURNING id, name")
      .get(normalized.data);
    if (!inserted) {
      return err("db_query_failed", "Failed to insert tag", {
        operation: "tags.create",
        name: normalized.data,
      });
    }
    return ok(inserted);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "tags.create",
      name,
    });
  }
}

function rename(id: number, name: string): Result<TagRow> {
  const normalized = normalizeName(name);
  if (normalized.error) return normalized;

  try {
    const current = db
      .query<TagRow, [number]>("SELECT id, name FROM Tags WHERE id = ?")
      .get(id);
    if (!current) {
      return err("tag_not_found", "Tag not found", {
        operation: "tags.rename",
        id,
      });
    }

    if (current.name === normalized.data) return ok(current);

    const conflict = db
      .query<TagRow, [string]>("SELECT id, name FROM Tags WHERE name = ?")
      .get(normalized.data);
    if (conflict && conflict.id !== id) {
      return err("tag_conflict", "A tag with that name already exists", {
        operation: "tags.rename",
        id,
        name: normalized.data,
      });
    }

    db.query("UPDATE Tags SET name = ? WHERE id = ?").run(normalized.data, id);
    return ok({ id, name: normalized.data });
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "tags.rename",
      id,
      name,
    });
  }
}

function remove(id: number): Result<void> {
  try {
    const result = db.query("DELETE FROM Tags WHERE id = ?").run(id);
    if (result.changes === 0) {
      return err("tag_not_found", "Tag not found", {
        operation: "tags.remove",
        id,
      });
    }
    return ok(undefined);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "tags.remove",
      id,
    });
  }
}

function readForFeed(feedId: number): Result<TagRow[]> {
  return db.safeQuery<TagRow>(
    `SELECT t.id, t.name FROM Tags t
     INNER JOIN FeedTags ft ON ft.tagId = t.id
     WHERE ft.feedId = ?
     ORDER BY t.id ASC`,
    [feedId]
  );
}

type AssignInput = { tagId: number } | { name: string };

function assign(feedId: number, input: AssignInput): Result<TagRow> {
  try {
    const feed = db
      .query<{ id: number }, [number]>("SELECT id FROM feeds WHERE id = ?")
      .get(feedId);
    if (!feed) {
      return err("feed_not_found", "Feed not found", {
        operation: "tags.assign",
        feedId,
      });
    }

    let tag: TagRow | null;
    if ("tagId" in input) {
      const tagResult = readById(input.tagId);
      if (tagResult.error) return tagResult;
      if (!tagResult.data) {
        return err("tag_not_found", "Tag not found", {
          operation: "tags.assign",
          feedId,
          tagId: input.tagId,
        });
      }
      tag = tagResult.data;
    } else {
      const created = create(input.name);
      if (created.error) return created;
      tag = created.data;
    }

    db.query(
      "INSERT OR IGNORE INTO FeedTags (feedId, tagId) VALUES (?, ?)"
    ).run(feedId, tag.id);

    return ok(tag);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "tags.assign",
      feedId,
      input,
    });
  }
}

function unassign(feedId: number, tagId: number): Result<void> {
  try {
    db.query("DELETE FROM FeedTags WHERE feedId = ? AND tagId = ?").run(
      feedId,
      tagId
    );
    return ok(undefined);
  } catch (e) {
    return err("db_query_failed", e instanceof Error ? e.message : String(e), {
      operation: "tags.unassign",
      feedId,
      tagId,
    });
  }
}

export const tags = {
  readAll,
  readById,
  readByName,
  create,
  rename,
  remove,
  readForFeed,
  assign,
  unassign,
  normalizeName,
};
