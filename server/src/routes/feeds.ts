import { ok } from "@whisker/common";
import { fetchFeed } from "../lib/feed/fetch";
import { refreshStoredFeed } from "../lib/feed/refresh";
import { errorStatus, json } from "../lib/http";
import { feeds } from "../models/feeds.model";

export function handleList(): Response {
  const result = feeds.readAll();
  if (result.error) return json(result, 500);
  return json(result);
}

export async function handleCreate(req: Request): Promise<Response> {
  const body = await req.json();
  if (!body.url)
    return json(
      { error: { code: "fetch_failed", message: "url is required" } },
      400
    );

  const fetchResult = await fetchFeed(body.url);
  if (fetchResult.error) return json(fetchResult, 400);

  const upsertResult = feeds.upsert(fetchResult.data);
  if (upsertResult.error) return json(upsertResult, 500);

  return json(fetchResult, 201);
}

export function handleDelete(id: number): Response {
  const result = feeds.remove(id);
  if (result.error) return json(result, 500);
  return json(result);
}

export async function handleRefresh(id: number): Promise<Response> {
  const result = await refreshStoredFeed(id);
  if (result.error) return json(result, errorStatus(result.error.code));
  return json(ok(undefined));
}

export async function handleUpdate(
  id: number,
  req: Request
): Promise<Response> {
  const body = await req.json();
  const result = feeds.update(id, body);
  if (result.error) return json(result, errorStatus(result.error.code));
  return json(result);
}
