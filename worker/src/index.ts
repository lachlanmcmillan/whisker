import { fetchFeed } from "./feed/fetch";
import { authenticatedUser } from "./auth";
import { handleAuthRoute } from "./auth-routes";
import {
  createTag,
  FeedFetchError,
  InputError,
  normalizeTagName,
  readFeeds,
  readFeedTags,
  refreshDueFeeds,
  refreshIntervalFrom,
  refreshStoredFeed,
  importFeeds,
  updateEntry,
  updateFeed,
  type TagRow,
} from "./data";
import { fillVideoDurations } from "./youtube";

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  API_KEY?: string;
  YOUTUBE_API_KEY?: string;
}

// Missing video lengths shouldn't fail the request that triggered the lookup.
async function fillDurations(env: Env): Promise<void> {
  try {
    await fillVideoDurations(env.DB, env.YOUTUBE_API_KEY);
  } catch (error) {
    console.error("youtube_duration_failed", error);
  }
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
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

function feedIdsFrom(body: Record<string, unknown>): number[] {
  const ids = body.feedIds;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 1000 ||
    !ids.every(id => Number.isInteger(id))
  ) {
    throw new InputError("feedIds must be an array of 1 to 1000 feed ids");
  }
  return ids as number[];
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

  if (pathname === "/query") return fail("not_found", "Not found", 404);
  const user = await authenticatedUser(db, req);
  if (!user) return fail("unauthorized", "Sign in required", 401);

  try {
    if (method === "GET" && pathname === "/feeds")
      return ok(await readFeeds(db, user.id));

    // Bulk update; only the refresh interval can be changed across feeds.
    if (method === "PATCH" && pathname === "/feeds") {
      const body = await bodyObject(req);
      const feedIds = feedIdsFrom(body);
      const mins = refreshIntervalFrom(body.refreshIntervalMins);
      await db
        .prepare(
          `UPDATE UserFeeds SET refreshIntervalMins = ?
          WHERE userId = ? AND feedId IN (SELECT value FROM json_each(?))`
        )
        .bind(mins, user.id, JSON.stringify(feedIds))
        .run();
      return ok();
    }

    if (method === "POST" && pathname === "/feeds") {
      const body = await bodyObject(req);
      const submitted =
        Array.isArray(body.urls) ? body.urls
        : typeof body.url === "string" ? [body.url]
        : null;
      if (!submitted || submitted.length === 0 || submitted.length > 100) {
        throw new InputError("Provide 1 to 100 feed URLs");
      }
      const urls = submitted.map((value, index) => {
        if (typeof value !== "string" || !value.trim())
          throw new InputError(`Line ${index + 1}: enter a URL`);
        const url = value.trim();
        try {
          const parsed = new URL(url);
          if (
            !["http:", "https:"].includes(parsed.protocol) ||
            parsed.username ||
            parsed.password
          )
            throw new Error("unsupported URL");
        } catch {
          throw new InputError(
            `Line ${index + 1}: enter a valid HTTP or HTTPS URL`
          );
        }
        return url;
      });
      const parsedFeeds: Awaited<ReturnType<typeof fetchFeed>>[] = new Array(
        urls.length
      );
      const fetchErrors: boolean[] = new Array(urls.length).fill(false);
      let nextIndex = 0;
      await Promise.all(
        Array.from({ length: Math.min(3, urls.length) }, async () => {
          while (nextIndex < urls.length) {
            const index = nextIndex++;
            try {
              parsedFeeds[index] = await fetchFeed(urls[index]);
            } catch (error) {
              console.error("feed_import_fetch_failed", index + 1, error);
              fetchErrors[index] = true;
            }
          }
        })
      );
      const thrownIndex = fetchErrors.findIndex(Boolean);
      if (thrownIndex !== -1)
        return fail(
          "invalid_feed",
          `Line ${thrownIndex + 1}: could not read feed`,
          400
        );
      const invalidIndex = parsedFeeds.findIndex(result => result.error);
      if (invalidIndex !== -1) {
        const failure = parsedFeeds[invalidIndex];
        return fail(
          "invalid_feed",
          `Line ${invalidIndex + 1}: ${failure.error!.message}`,
          400
        );
      }
      await importFeeds(
        db,
        user.id,
        parsedFeeds.map(result => result.data!)
      );
      await fillDurations(env);
      return ok({ imported: urls.length }, 201);
    }

    const feedId = idFrom(pathname, /^\/feeds\/(\d+)$/);
    if (feedId !== null) {
      if (method === "DELETE") {
        await db
          .prepare("DELETE FROM UserFeeds WHERE userId = ? AND feedId = ?")
          .bind(user.id, feedId)
          .run();
        return ok();
      }
      if (method === "PATCH") {
        const row = await updateFeed(
          db,
          user.id,
          feedId,
          await bodyObject(req)
        );
        return row ? ok(row) : fail("feed_not_found", "Feed not found", 404);
      }
    }

    const refreshId = idFrom(pathname, /^\/feeds\/(\d+)\/refresh$/);
    if (refreshId !== null && method === "POST") {
      const subscribed = await db
        .prepare("SELECT 1 FROM UserFeeds WHERE userId = ? AND feedId = ?")
        .bind(user.id, refreshId)
        .first();
      if (!subscribed) return fail("feed_not_found", "Feed not found", 404);
      const found = await refreshStoredFeed(db, refreshId);
      if (found) await fillDurations(env);
      return found ? ok() : fail("feed_not_found", "Feed not found", 404);
    }

    const feedTagsId = idFrom(pathname, /^\/feeds\/(\d+)\/tags$/);
    if (feedTagsId !== null) {
      const exists = await db
        .prepare(
          "SELECT feedId AS id FROM UserFeeds WHERE userId = ? AND feedId = ?"
        )
        .bind(user.id, feedTagsId)
        .first<{ id: number }>();
      if (!exists) return fail("feed_not_found", "Feed not found", 404);
      if (method === "GET")
        return ok(await readFeedTags(db, user.id, feedTagsId));
      if (method === "POST") {
        const body = await bodyObject(req);
        let tag: TagRow | null;
        if (typeof body.tagId === "number" && Number.isInteger(body.tagId)) {
          tag = await db
            .prepare(
              "SELECT id, name FROM UserTags WHERE userId = ? AND id = ?"
            )
            .bind(user.id, body.tagId)
            .first<TagRow>();
          if (!tag) return fail("tag_not_found", "Tag not found", 404);
        } else if ("name" in body) {
          tag = await createTag(db, user.id, body.name);
        } else {
          throw new InputError(
            "Body must include tagId (number) or name (string)"
          );
        }
        await db
          .prepare(
            "INSERT OR IGNORE INTO UserFeedTags (userId, feedId, tagId) VALUES (?, ?, ?)"
          )
          .bind(user.id, feedTagsId, tag.id)
          .run();
        return ok(tag);
      }
    }

    const unassignMatch = /^\/feeds\/(\d+)\/tags\/(\d+)$/.exec(pathname);
    if (unassignMatch && method === "DELETE") {
      await db
        .prepare(
          "DELETE FROM UserFeedTags WHERE userId = ? AND feedId = ? AND tagId = ?"
        )
        .bind(user.id, Number(unassignMatch[1]), Number(unassignMatch[2]))
        .run();
      return ok();
    }

    if (method === "GET" && pathname === "/tags") {
      const { results } = await db
        .prepare("SELECT id, name FROM UserTags WHERE userId = ? ORDER BY name")
        .bind(user.id)
        .all<TagRow>();
      return ok(results);
    }
    if (method === "POST" && pathname === "/tags") {
      const body = await bodyObject(req);
      return ok(await createTag(db, user.id, body.name));
    }

    if (method === "POST" && pathname === "/tags/assign") {
      const body = await bodyObject(req);
      const feedIds = feedIdsFrom(body);
      let tag: TagRow | null;
      if (typeof body.tagId === "number" && Number.isInteger(body.tagId)) {
        tag = await db
          .prepare("SELECT id, name FROM UserTags WHERE userId = ? AND id = ?")
          .bind(user.id, body.tagId)
          .first<TagRow>();
        if (!tag) return fail("tag_not_found", "Tag not found", 404);
      } else if ("name" in body) {
        tag = await createTag(db, user.id, body.name);
      } else {
        throw new InputError(
          "Body must include tagId (number) or name (string)"
        );
      }
      // Joining UserFeeds skips ids the user isn't subscribed to.
      await db
        .prepare(
          `INSERT OR IGNORE INTO UserFeedTags (userId, feedId, tagId)
          SELECT userId, feedId, ? FROM UserFeeds
          WHERE userId = ? AND feedId IN (SELECT value FROM json_each(?))`
        )
        .bind(tag.id, user.id, JSON.stringify(feedIds))
        .run();
      return ok(tag);
    }

    if (method === "POST" && pathname === "/tags/unassign") {
      const body = await bodyObject(req);
      const feedIds = feedIdsFrom(body);
      if (typeof body.tagId !== "number" || !Number.isInteger(body.tagId)) {
        throw new InputError("Body must include tagId (number)");
      }
      await db
        .prepare(
          `DELETE FROM UserFeedTags
          WHERE userId = ? AND tagId = ? AND feedId IN (SELECT value FROM json_each(?))`
        )
        .bind(user.id, body.tagId, JSON.stringify(feedIds))
        .run();
      return ok();
    }

    const tagId = idFrom(pathname, /^\/tags\/(\d+)$/);
    if (tagId !== null) {
      if (method === "PUT") {
        const body = await bodyObject(req);
        const name = normalizeTagName(body.name);
        const current = await db
          .prepare("SELECT id, name FROM UserTags WHERE userId = ? AND id = ?")
          .bind(user.id, tagId)
          .first<TagRow>();
        if (!current) return fail("tag_not_found", "Tag not found", 404);
        if (current.name === name) return ok(current);
        const conflict = await db
          .prepare("SELECT id FROM UserTags WHERE userId = ? AND name = ?")
          .bind(user.id, name)
          .first<{ id: number }>();
        if (conflict)
          return fail(
            "tag_conflict",
            "A tag with that name already exists",
            409
          );
        await db
          .prepare("UPDATE UserTags SET name = ? WHERE userId = ? AND id = ?")
          .bind(name, user.id, tagId)
          .run();
        return ok({ id: tagId, name });
      }
      if (method === "DELETE") {
        const result = await db
          .prepare("DELETE FROM UserTags WHERE userId = ? AND id = ?")
          .bind(user.id, tagId)
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
        user.id,
        Number(entryMatch[1]),
        decodeURIComponent(entryMatch[2]),
        await bodyObject(req)
      );
      return row ? ok(row) : fail("entry_not_found", "Entry not found", 404);
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
    return fail("internal_error", "Request failed", 500);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    if (
      !["GET", "HEAD"].includes(req.method) &&
      new URL(req.url).pathname !== "/auth/bootstrap"
    ) {
      const origin = req.headers.get("Origin");
      if (origin !== new URL(req.url).origin)
        return fail("forbidden", "Invalid request origin", 403);
    }
    const authResponse = await handleAuthRoute(req, env);
    if (authResponse) return authResponse;
    const response = await api(req, env);
    return response ?? env.ASSETS.fetch(req);
  },
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      refreshDueFeeds(env.DB).then(refreshed =>
        refreshed > 0 ? fillDurations(env) : undefined
      )
    );
  },
} satisfies ExportedHandler<Env>;
