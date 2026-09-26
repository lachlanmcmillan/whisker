import { fetchFeed } from "../../server/src/lib/feed/fetch";
import {
  createTag,
  FeedFetchError,
  InputError,
  normalizeTagName,
  readFeeds,
  readFeedTags,
  refreshDueFeeds,
  refreshStoredFeed,
  updateEntry,
  updateFeed,
  upsertFeed,
  type TagRow,
} from "./data";

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  API_KEY?: string;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function ok(data?: unknown, status = 200): Response {
  return json({ data }, status);
}

function fail(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

async function bodyObject(req: Request): Promise<Record<string, unknown>> {
  const body: unknown = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InputError("Expected a JSON object");
  }
  return body as Record<string, unknown>;
}

function idFrom(path: string, pattern: RegExp): number | null {
  const match = pattern.exec(path);
  return match ? Number(match[1]) : null;
}

async function api(req: Request, env: Env): Promise<Response | null> {
  const { pathname } = new URL(req.url);
  const method = req.method;
  const db = env.DB;

  if (method === "GET" && pathname === "/monitor") {
    return json({
      serverTime: new Date().toISOString(),
      runtime: "cloudflare-worker",
    });
  }

  const isApiPath =
    pathname === "/feeds" ||
    pathname.startsWith("/feeds/") ||
    pathname === "/tags" ||
    pathname.startsWith("/tags/") ||
    pathname.startsWith("/entries/") ||
    pathname === "/query";
  if (!isApiPath) return null;

  if (!env.API_KEY)
    return fail("not_configured", "API key is not configured", 503);
  if (req.headers.get("Authorization") !== `Bearer ${env.API_KEY}`) {
    return fail("unauthorized", "Invalid or missing API key", 401);
  }

  try {
    if (method === "GET" && pathname === "/feeds")
      return ok(await readFeeds(db));

    if (method === "POST" && pathname === "/feeds") {
      const body = await bodyObject(req);
      if (typeof body.url !== "string" || !body.url) {
        throw new InputError("url is required");
      }
      const parsed = await fetchFeed(body.url);
      if (parsed.error)
        return fail(parsed.error.code, parsed.error.message, 400);
      await upsertFeed(db, parsed.data);
      return ok(parsed.data, 201);
    }

    const feedId = idFrom(pathname, /^\/feeds\/(\d+)$/);
    if (feedId !== null) {
      if (method === "DELETE") {
        await db.prepare("DELETE FROM feeds WHERE id = ?").bind(feedId).run();
        return ok();
      }
      if (method === "PATCH") {
        const row = await updateFeed(db, feedId, await bodyObject(req));
        return row ? ok(row) : fail("feed_not_found", "Feed not found", 404);
      }
    }

    const refreshId = idFrom(pathname, /^\/feeds\/(\d+)\/refresh$/);
    if (refreshId !== null && method === "POST") {
      const found = await refreshStoredFeed(db, refreshId);
      return found ? ok() : fail("feed_not_found", "Feed not found", 404);
    }

    const feedTagsId = idFrom(pathname, /^\/feeds\/(\d+)\/tags$/);
    if (feedTagsId !== null) {
      const exists = await db
        .prepare("SELECT id FROM feeds WHERE id = ?")
        .bind(feedTagsId)
        .first<{ id: number }>();
      if (!exists) return fail("feed_not_found", "Feed not found", 404);
      if (method === "GET") return ok(await readFeedTags(db, feedTagsId));
      if (method === "POST") {
        const body = await bodyObject(req);
        let tag: TagRow | null;
        if (typeof body.tagId === "number" && Number.isInteger(body.tagId)) {
          tag = await db
            .prepare("SELECT id, name FROM Tags WHERE id = ?")
            .bind(body.tagId)
            .first<TagRow>();
          if (!tag) return fail("tag_not_found", "Tag not found", 404);
        } else if ("name" in body) {
          tag = await createTag(db, body.name);
        } else {
          throw new InputError(
            "Body must include tagId (number) or name (string)"
          );
        }
        await db
          .prepare(
            "INSERT OR IGNORE INTO FeedTags (feedId, tagId) VALUES (?, ?)"
          )
          .bind(feedTagsId, tag.id)
          .run();
        return ok(tag);
      }
    }

    const unassignMatch = /^\/feeds\/(\d+)\/tags\/(\d+)$/.exec(pathname);
    if (unassignMatch && method === "DELETE") {
      await db
        .prepare("DELETE FROM FeedTags WHERE feedId = ? AND tagId = ?")
        .bind(Number(unassignMatch[1]), Number(unassignMatch[2]))
        .run();
      return ok();
    }

    if (method === "GET" && pathname === "/tags") {
      const { results } = await db
        .prepare("SELECT id, name FROM Tags ORDER BY name")
        .all<TagRow>();
      return ok(results);
    }
    if (method === "POST" && pathname === "/tags") {
      const body = await bodyObject(req);
      return ok(await createTag(db, body.name));
    }

    const tagId = idFrom(pathname, /^\/tags\/(\d+)$/);
    if (tagId !== null) {
      if (method === "PUT") {
        const body = await bodyObject(req);
        const name = normalizeTagName(body.name);
        const current = await db
          .prepare("SELECT id, name FROM Tags WHERE id = ?")
          .bind(tagId)
          .first<TagRow>();
        if (!current) return fail("tag_not_found", "Tag not found", 404);
        if (current.name === name) return ok(current);
        const conflict = await db
          .prepare("SELECT id FROM Tags WHERE name = ?")
          .bind(name)
          .first<{ id: number }>();
        if (conflict)
          return fail(
            "tag_conflict",
            "A tag with that name already exists",
            409
          );
        await db
          .prepare("UPDATE Tags SET name = ? WHERE id = ?")
          .bind(name, tagId)
          .run();
        return ok({ id: tagId, name });
      }
      if (method === "DELETE") {
        const result = await db
          .prepare("DELETE FROM Tags WHERE id = ?")
          .bind(tagId)
          .run();
        return result.meta.changes ?
            ok()
          : fail("tag_not_found", "Tag not found", 404);
      }
    }

    const entryMatch = /^\/entries\/(\d+)\/([^/]+)$/.exec(pathname);
    if (entryMatch && method === "PATCH") {
      const row = await updateEntry(
        db,
        Number(entryMatch[1]),
        decodeURIComponent(entryMatch[2]),
        await bodyObject(req)
      );
      return row ? ok(row) : fail("entry_not_found", "Entry not found", 404);
    }

    if (method === "POST" && pathname === "/query") {
      const body = await bodyObject(req);
      if (typeof body.sql !== "string" || !body.sql.trim()) {
        throw new InputError("sql is required");
      }
      const { results } = await db.prepare(body.sql).all();
      return ok(results);
    }

    return fail("not_found", "Not found", 404);
  } catch (error) {
    if (error instanceof InputError || error instanceof SyntaxError) {
      return fail("invalid_input", error.message, 400);
    }
    if (error instanceof FeedFetchError) {
      return fail(error.code, error.message, 502);
    }
    console.error("api_failed", method, pathname, error);
    return fail(
      "db_query_failed",
      error instanceof Error ? error.message : String(error),
      500
    );
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    const response = await api(req, env);
    return response ?? env.ASSETS.fetch(req);
  },
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(refreshDueFeeds(env.DB));
  },
} satisfies ExportedHandler<Env>;
