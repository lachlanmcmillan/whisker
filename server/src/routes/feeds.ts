import { ok } from "@whisker/common";
import { fetchFeed } from "../lib/feed/fetch";
import { refreshStoredFeed } from "../lib/feed/refresh";
import { errorStatus, json } from "../lib/http";
import { feeds } from "../models/feeds.model";
import { tags } from "../models/tags.model";

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

export function handleListTags(feedId: number): Response {
  const feed = feeds.readById(feedId);
  if (feed.error) return json(feed, errorStatus(feed.error.code));
  if (!feed.data) {
    return json(
      { error: { code: "feed_not_found", message: "Feed not found" } },
      404
    );
  }
  const result = tags.readForFeed(feedId);
  if (result.error) return json(result, errorStatus(result.error.code));
  return json(result);
}

export async function handleAssignTag(
  feedId: number,
  req: Request
): Promise<Response> {
  const body = await req.json();
  let input: { tagId: number } | { name: string };
  if (typeof body?.tagId === "number") {
    input = { tagId: body.tagId };
  } else if (typeof body?.name === "string") {
    input = { name: body.name };
  } else {
    return json(
      {
        error: {
          code: "invalid_input",
          message: "Body must include tagId (number) or name (string)",
        },
      },
      400
    );
  }
  const result = tags.assign(feedId, input);
  if (result.error) return json(result, errorStatus(result.error.code));
  return json(result);
}

export function handleUnassignTag(feedId: number, tagId: number): Response {
  const result = tags.unassign(feedId, tagId);
  if (result.error) return json(result, errorStatus(result.error.code));
  return json(result);
}
