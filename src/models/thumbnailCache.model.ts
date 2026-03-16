import { sql } from "../lib/sqlite/sqlite";

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
): Promise<void> {
  await sql`
    INSERT INTO thumbnailCache (url, data, contentType)
    VALUES (${url}, ${data}, ${contentType})
        ON CONFLICT(url) DO UPDATE SET
             data = excluded.data,
      contentType = excluded.contentType,
        fetchedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
}

export async function readCachedThumbnail(
  url: string
): Promise<ThumbnailCache | null> {
  const rows = await sql<ThumbnailCache>`
      SELECT *
        FROM thumbnailCache
       WHERE url = ${url}
    `;

  const row = rows[0];
  if (!row) return null;

  await sql`
    UPDATE thumbnailCache
       SET lastAccessedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE url = ${url}
  `;

  return row;
}

export async function deleteCachedThumbnail(url: string): Promise<void> {
  await sql`
    DELETE FROM thumbnailCache
     WHERE url = ${url}
  `;
}
