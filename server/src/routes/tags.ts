import { errorStatus, json } from "../lib/http";
import { tags } from "../models/tags.model";

export function handleList(): Response {
  const result = tags.readAll();
  if (result.error) return json(result, errorStatus(result.error.code));
  return json(result);
}

export async function handleCreate(req: Request): Promise<Response> {
  const body = await req.json();
  const result = tags.create(body?.name);
  if (result.error) return json(result, errorStatus(result.error.code));
  return json(result, 201);
}

export async function handleRename(id: number, req: Request): Promise<Response> {
  const body = await req.json();
  const result = tags.rename(id, body?.name);
  if (result.error) return json(result, errorStatus(result.error.code));
  return json(result);
}

export function handleDelete(id: number): Response {
  const result = tags.remove(id);
  if (result.error) return json(result, errorStatus(result.error.code));
  return json(result);
}
