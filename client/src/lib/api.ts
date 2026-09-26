const BASE = import.meta.env.VITE_API_URL ?? "";

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

async function handleResponse(res: Response, invalidateSession = true) {
  if (res.status === 401 && invalidateSession) {
    onUnauthorized?.();
  }
  const result = await res.json();
  if (result.error) throw new Error(result.error.message);
  return result;
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (
    await handleResponse(res, !["/auth/login", "/auth/password"].includes(path))
  ).data as T;
}

export interface User {
  id: string;
  email: string;
  role: "owner" | "member";
  createdAt: string;
  disabledAt: string | null;
}

export const currentUser = () => request<User>("/auth/me");
export const login = (email: string, password: string) =>
  request<User>("/auth/login", "POST", { email, password });
export const logout = () => request<null>("/auth/logout", "POST");
export const inspectAccountToken = (token: string) =>
  request<{ email: string; purpose: string }>("/auth/token", "POST", { token });
export const acceptAccountToken = (token: string, password: string) =>
  request<User>("/auth/accept", "POST", { token, password });
export const changePassword = (currentPassword: string, newPassword: string) =>
  request<User>("/auth/password", "POST", { currentPassword, newPassword });
export const listUsers = () => request<User[]>("/auth/users");
export const inviteUser = (email: string) =>
  request<{ inviteUrl: string }>("/auth/invites", "POST", { email });
export const resetUser = (id: string) =>
  request<{ resetUrl: string }>(`/auth/users/${id}/reset-link`, "POST");
export const disableUser = (id: string) =>
  request<null>(`/auth/users/${id}/disable`, "POST");

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
  archivedAt?: string | null;
  starredAt?: string | null;
}

export interface Tag {
  id: number;
  name: string;
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
  refreshIntervalMins: number | null;
  entries: FeedEntry[];
  tags: Tag[];
}

export async function fetchFeeds(): Promise<Feed[]> {
  const res = await fetch(`${BASE}/feeds`, { credentials: "include" });
  const result = await handleResponse(res);
  return result.data;
}

type EditableFeedFields = Pick<
  Feed,
  "title" | "description" | "author" | "image" | "link" | "refreshIntervalMins"
>;

export async function addFeeds(urls: string[]): Promise<void> {
  const res = await fetch(`${BASE}/feeds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ urls }),
  });
  await handleResponse(res);
}

export async function addFeed(url: string): Promise<void> {
  await addFeeds([url]);
}

export async function deleteFeed(id: number): Promise<void> {
  const res = await fetch(`${BASE}/feeds/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await handleResponse(res);
}

export async function updateFeed(
  id: number,
  data: Partial<EditableFeedFields>
): Promise<Feed> {
  const res = await fetch(`${BASE}/feeds/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const result = await handleResponse(res);
  return result.data;
}

export async function refreshFeed(id: number): Promise<void> {
  const res = await fetch(`${BASE}/feeds/${id}/refresh`, {
    method: "POST",
    credentials: "include",
  });
  await handleResponse(res);
}

export async function listTagsForFeed(feedId: number): Promise<Tag[]> {
  const res = await fetch(`${BASE}/feeds/${feedId}/tags`, {
    credentials: "include",
  });
  const result = await handleResponse(res);
  return result.data;
}

export async function assignTagToFeed(
  feedId: number,
  input: { tagId: number } | { name: string }
): Promise<Tag> {
  const res = await fetch(`${BASE}/feeds/${feedId}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  const result = await handleResponse(res);
  return result.data;
}

export async function unassignTagFromFeed(
  feedId: number,
  tagId: number
): Promise<void> {
  const res = await fetch(`${BASE}/feeds/${feedId}/tags/${tagId}`, {
    method: "DELETE",
    credentials: "include",
  });
  await handleResponse(res);
}

export async function listTags(): Promise<Tag[]> {
  const res = await fetch(`${BASE}/tags`, { credentials: "include" });
  const result = await handleResponse(res);
  return result.data;
}

export const renameTag = (id: number, name: string) =>
  request<Tag>(`/tags/${id}`, "PUT", { name });
export const deleteTag = (id: number) => request<null>(`/tags/${id}`, "DELETE");

export async function updateEntry(
  feedId: number,
  entryId: string,
  data: Partial<Pick<FeedEntry, "openedAt" | "archivedAt" | "starredAt">>
): Promise<FeedEntry> {
  const res = await fetch(
    `${BASE}/entries/${feedId}/${encodeURIComponent(entryId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    }
  );
  const result = await handleResponse(res);
  return result.data;
}
