const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const API_KEY_STORAGE_KEY = "whisker_api_key";

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

function authHeaders(): Record<string, string> {
  const key = getApiKey();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

async function handleResponse(res: Response) {
  if (res.status === 401) {
    clearApiKey();
    onUnauthorized?.();
    throw new Error("Unauthorized");
  }
  const result = await res.json();
  if (result.error) throw new Error(result.error.message);
  return result;
}

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
  const res = await fetch(`${BASE}/feeds`, { headers: authHeaders() });
  const result = await handleResponse(res);
  return result.data;
}

export async function addFeed(url: string): Promise<Feed> {
  const res = await fetch(`${BASE}/feeds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ url }),
  });
  const result = await handleResponse(res);
  return result.data;
}

export async function deleteFeed(id: number): Promise<void> {
  const res = await fetch(`${BASE}/feeds/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleResponse(res);
}

export async function refreshFeed(id: number): Promise<Feed> {
  const res = await fetch(`${BASE}/feeds/${id}/refresh`, {
    method: "POST",
    headers: authHeaders(),
  });
  const result = await handleResponse(res);
  return result.data;
}

export async function query(sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ sql }),
  });
  const result = await handleResponse(res);
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
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ openedAt }),
    }
  );
  await handleResponse(res);
}
