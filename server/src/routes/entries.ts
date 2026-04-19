import { errorStatus, json } from "../lib/http";
import { feeds } from "../models/feeds.model";

export async function handleUpdate(
  feedId: number,
  entryId: string,
  req: Request
): Promise<Response> {
  const body = await req.json();
  const result = feeds.updateEntry(feedId, entryId, body);
  if (result.error) return json(result, errorStatus(result.error.code));
  return json(result);
}
