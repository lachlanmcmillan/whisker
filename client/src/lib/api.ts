const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface FeedEntry {
  entryId: string;
  feedId?: number;
  title: string;
  link: string;
  author: string;
  published: string;
  updated?: string;
  description: string;
  thumbnail?: string;
  content?: string;
  openedAt?: string | null;
}

export interface Feed {
  id: number;
  title: string;
  description: string;
  link: string;
  feedUrl: string;
  author: string;
  published: string;
  image?: string;
  fetchedAt?: string;
  entries: FeedEntry[];
}

export async function fetchFeeds(): Promise<Feed[]> {
  const res = await fetch(`${BASE}/feeds`);
  const result = await res.json();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function addFeed(url: string): Promise<Feed> {
  const res = await fetch(`${BASE}/feeds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const result = await res.json();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function deleteFeed(id: number): Promise<void> {
  const res = await fetch(`${BASE}/feeds/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete feed");
}

export async function refreshFeed(id: number): Promise<Feed> {
  const res = await fetch(`${BASE}/feeds/${id}/refresh`, { method: "POST" });
  const result = await res.json();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function query(sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const result = await res.json();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function updateEntry(
  feedId: number,
  entryId: string,
  openedAt: string | null
): Promise<void> {
  const res = await fetch(
    `${BASE}/entries/${feedId}/${encodeURIComponent(entryId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openedAt }),
    }
  );
  if (!res.ok) throw new Error("Failed to update entry");
}
