const startedAt = Date.now();

function formatISOWithTZ(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map(p => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${parts.timeZoneName?.replace("GMT", "") || "+00:00"}`;
}

import { db } from "./db";
import { fetchFeed } from "./lib/feed/fetch";
import {
  readAllFeeds,
  readFeedById,
  upsertFeed,
  deleteFeed,
  updateEntryOpenedAt,
} from "./models/feed.model";
import { ok, err } from "@whisker/common";

const server = Bun.serve({
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // GET /monitor — unauthenticated
    if (method === "GET" && url.pathname === "/monitor") {
      return json({
        commit: process.env.COMMIT_SHA ?? "dev",
        serverTime: formatISOWithTZ(new Date(), "Australia/Melbourne"),
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      });
    }

    // Auth check — everything below requires a valid API key
    const apiKey = process.env.API_KEY;
    if (apiKey) {
      const auth = req.headers.get("Authorization");
      if (auth !== `Bearer ${apiKey}`) {
        return json(err("unauthorized", "Invalid or missing API key"), 401);
      }
    }

    // GET /feeds
    if (method === "GET" && url.pathname === "/feeds") {
      const result = readAllFeeds();
      if (result.error) return json(result, 500);
      return json(result);
    }

    // POST /feeds { url: string }
    if (method === "POST" && url.pathname === "/feeds") {
      const body = await req.json();
      if (!body.url)
        return json(
          { error: { code: "fetch_failed", message: "url is required" } },
          400
        );

      const fetchResult = await fetchFeed(body.url);
      if (fetchResult.error) return json(fetchResult, 400);

      const upsertResult = upsertFeed(fetchResult.data);
      if (upsertResult.error) return json(upsertResult, 500);

      return json(fetchResult, 201);
    }

    // DELETE /feeds/:id
    if (method === "DELETE" && url.pathname.match(/^\/feeds\/\d+$/)) {
      const id = parseInt(url.pathname.split("/")[2]);
      const result = deleteFeed(id);
      if (result.error) return json(result, 500);
      return json(result);
    }

    // POST /feeds/:id/refresh
    if (method === "POST" && url.pathname.match(/^\/feeds\/\d+\/refresh$/)) {
      const id = parseInt(url.pathname.split("/")[2]);

      const feedResult = readFeedById(id);
      if (feedResult.error) return json(feedResult, 500);
      if (!feedResult.data)
        return json(
          { error: { code: "feed_not_found", message: "Feed not found" } },
          404
        );

      const feedUrl = feedResult.data.feedUrl || feedResult.data.link;
      const fetchResult = await fetchFeed(feedUrl);
      if (fetchResult.error) return json(fetchResult, 500);

      const upsertResult = upsertFeed(fetchResult.data);
      if (upsertResult.error) return json(upsertResult, 500);

      return json(fetchResult);
    }

    // PATCH /entries/:feedId/:entryId
    if (method === "PATCH" && url.pathname.match(/^\/entries\/\d+\/[^/]+$/)) {
      const parts = url.pathname.split("/");
      const feedId = parseInt(parts[2]);
      const entryId = decodeURIComponent(parts[3]);
      const body = await req.json();

      if ("openedAt" in body) {
        const result = updateEntryOpenedAt(feedId, entryId, body.openedAt);
        if (result.error) return json(result, 500);
        return json(result);
      }

      return json({ data: undefined });
    }

    // POST /query { sql: string } — run arbitrary SQL (for DB explorer)
    if (method === "POST" && url.pathname === "/query") {
      const body = await req.json();
      if (!body.sql)
        return json(err("db_query_failed", "sql is required"), 400);

      try {
        const stmt = db.query(body.sql);
        const rows = stmt.all();
        return json(ok(rows));
      } catch (e) {
        return json(
          err("db_query_failed", e instanceof Error ? e.message : String(e)),
          400
        );
      }
    }

    return json({ error: { code: "not_found", message: "Not found" } }, 404);
  },
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data: any, status = 200) {
  return Response.json(data, {
    status,
    headers: corsHeaders(),
  });
}

console.log(`Whisker server running on http://localhost:${server.port}`);
