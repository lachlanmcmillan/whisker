import { sql } from "../lib/sqlite/sqlite";

export interface ThumbnailCache {
  id: number;
  entryId: number;
  url: string;
  data: string;
  contentType: string;
  fetchedAt: string;
  lastAccessedAt: string;
}

export async function writeCachedThumbnail(
  entryId: number,
  url: string,
  data: string,
  contentType: string
): Promise<void> {
  await sql`
    INSERT INTO thumbnailCache (entryId, url, data, contentType)
    VALUES (${entryId}, ${url}, ${data}, ${contentType})
        ON CONFLICT(entryId, url) DO UPDATE SET
             data = excluded.data,
      contentType = excluded.contentType,
        fetchedAt = datetime('now')`;
}

export async function readCachedThumbnail(
  entryId: number,
  url: string
): Promise<ThumbnailCache | null> {
  const rows = await sql<ThumbnailCache>`
      SELECT * 
        FROM thumbnailCache 
       WHERE entryId = ${entryId} 
         AND url = ${url}
    `;

  const row = rows[0];
  if (!row) return null;

  await sql`
    UPDATE thumbnailCache 
       SET lastAccessedAt = datetime('now') 
     WHERE entryId = ${entryId} 
       AND url = ${url}
  `;

  return row;
}

export async function deleteCachedThumbnail(
  entryId: number,
  url: string
): Promise<void> {
  await sql`
    DELETE FROM thumbnailCache 
     WHERE entryId = ${entryId} 
       AND url = ${url}
  `;
}
