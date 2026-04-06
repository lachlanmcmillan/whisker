import { sql } from "../lib/sqlite/sqlite";
import { ok, type AsyncResult } from "../lib/result";

export interface ThumbnailCache {
  id: number;
  url: string;
  data: string;
  contentType: string;
  fetchedAt: string;
  lastAccessedAt: string;
}

export async function writeCachedThumbnail(
  url: string,
  data: string,
  contentType: string
): AsyncResult<void> {
  const result = await sql`
    INSERT INTO thumbnailCache (url, data, contentType)
    VALUES (${url}, ${data}, ${contentType})
        ON CONFLICT(url) DO UPDATE SET
             data = excluded.data,
      contentType = excluded.contentType,
        fetchedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
  if (result.error) return result;

  return ok(undefined);
}

export async function readCachedThumbnail(
  url: string
): AsyncResult<ThumbnailCache | null> {
  const result = await sql<ThumbnailCache>`
      SELECT *
        FROM thumbnailCache
       WHERE url = ${url}
    `;
  if (result.error) return result;

  const row = result.data[0];
  if (!row) return ok(null);

  const updateResult = await sql`
    UPDATE thumbnailCache
       SET lastAccessedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE url = ${url}
  `;
  if (updateResult.error) return updateResult;

  return ok(row);
}

export async function deleteCachedThumbnail(url: string): AsyncResult<void> {
  const result = await sql`
    DELETE FROM thumbnailCache
     WHERE url = ${url}
  `;
  if (result.error) return result;

  return ok(undefined);
}
