import { createStore, reconcile } from "solid-js/store";
import type { Feed, FeedEntry } from "$lib/api";
import { fetchFeeds, updateEntry, updateFeed, deleteFeed } from "$lib/api";
import { appSettingsStore } from "$stores/settings.store";

const [feeds, setFeeds] = createStore<Feed[]>([]);

function isEntryVisible(entry: FeedEntry): boolean {
  const [appSettings] = appSettingsStore;
  if (!appSettings.showUnreadOnly) return true;
  return !entry.openedAt && !entry.archivedAt;
}

async function loadFeeds() {
  const data = await fetchFeeds();
  setFeeds(reconcile(data, { key: "id", merge: false }));
  return data;
}

async function toggleEntryRead(
  feedId: number,
  entryId: string,
  currentlyOpened: boolean
) {
  const openedAt = currentlyOpened ? null : new Date().toISOString();
  await updateEntry(feedId, entryId, { openedAt });
  await loadFeeds();
}

async function toggleEntryArchived(
  feedId: number,
  entryId: string,
  currentlyArchived: boolean
) {
  const archivedAt = currentlyArchived ? null : new Date().toISOString();
  await updateEntry(feedId, entryId, { archivedAt });
  await loadFeeds();
}

async function toggleEntryStarred(
  feedId: number,
  entryId: string,
  currentlyStarred: boolean
) {
  const starredAt = currentlyStarred ? null : new Date().toISOString();
  await updateEntry(feedId, entryId, { starredAt });
  await loadFeeds();
}

async function editFeed(
  feedId: number,
  data: Partial<Pick<Feed, "title" | "description" | "author" | "image" | "link" | "feedUrl">>
) {
  await updateFeed(feedId, data);
  await loadFeeds();
}

async function removeFeed(feedId: number) {
  await deleteFeed(feedId);
  await loadFeeds();
}

export {
  feeds,
  loadFeeds,
  editFeed,
  toggleEntryRead,
  toggleEntryArchived,
  toggleEntryStarred,
  removeFeed,
  isEntryVisible,
};
