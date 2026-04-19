import { corsHeaders, json } from "../lib/http";
import { err } from "@whisker/common";
import * as entries from "./entries";
import * as feeds from "./feeds";
import { handleMonitor } from "./monitor";
import { handleQuery } from "./query";

export async function dispatch(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  const pathname = url.pathname;

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (method === "GET" && pathname === "/monitor") {
    return handleMonitor();
  }

  const apiKey = process.env.API_KEY;
  if (apiKey) {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${apiKey}`) {
      return json(
        err("unauthorized", "Invalid or missing API key", {
          method,
          pathname,
          hasAuthorizationHeader: auth !== null,
        }),
        401
      );
    }
  }

  if (method === "GET" && pathname === "/feeds") {
    return feeds.handleList();
  }

  if (method === "POST" && pathname === "/feeds") {
    return feeds.handleCreate(req);
  }

  if (method === "DELETE" && pathname.match(/^\/feeds\/\d+$/)) {
    const id = parseInt(pathname.split("/")[2]);
    return feeds.handleDelete(id);
  }

  if (method === "POST" && pathname.match(/^\/feeds\/\d+\/refresh$/)) {
    const id = parseInt(pathname.split("/")[2]);
    return feeds.handleRefresh(id);
  }

  if (method === "PATCH" && pathname.match(/^\/feeds\/\d+$/)) {
    const id = parseInt(pathname.split("/")[2]);
    return feeds.handleUpdate(id, req);
  }

  if (method === "PATCH" && pathname.match(/^\/entries\/\d+\/[^/]+$/)) {
    const parts = pathname.split("/");
    const feedId = parseInt(parts[2]);
    const entryId = decodeURIComponent(parts[3]);
    return entries.handleUpdate(feedId, entryId, req);
  }

  if (method === "POST" && pathname === "/query") {
    return handleQuery(req);
  }

  return json({ error: { code: "not_found", message: "Not found" } }, 404);
}
