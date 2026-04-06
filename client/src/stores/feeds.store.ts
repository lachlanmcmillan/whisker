import { createStore, reconcile } from "solid-js/store";
import type { Feed } from "../lib/api";
import { fetchFeeds, updateEntry } from "../lib/api";

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
  await updateEntry(feedId, entryId, openedAt);
  await loadFeeds();
}

export { feeds, loadFeeds, toggleEntryRead };
