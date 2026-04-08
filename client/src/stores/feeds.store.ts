import { createStore, reconcile } from "solid-js/store";
import type { Feed } from "$lib/api";
import { fetchFeeds, updateEntry, deleteFeed } from "$lib/api";

const [feeds, setFeeds] = createStore<Feed[]>([]);

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

async function removeFeed(feedId: number) {
  await deleteFeed(feedId);
  await loadFeeds();
}

export {
  feeds,
  loadFeeds,
  toggleEntryRead,
  toggleEntryArchived,
  toggleEntryStarred,
  removeFeed,
};
