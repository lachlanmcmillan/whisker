import { createStore, reconcile } from "solid-js/store";
import type { Feed } from "../models/feed.model";
import {
  readAllFeeds,
  markEntryOpened,
  clearEntryOpened,
} from "../models/feed.model";

const [feeds, setFeeds] = createStore<Feed[]>([]);

async function loadFeeds() {
  const result = await readAllFeeds();
  if (result.data) {
    setFeeds(reconcile(result.data, { key: "link", merge: false }));
  }
  return result;
}

async function toggleEntryRead(
  feedId: number,
  entryId: string,
  currentlyOpened: boolean
) {
  if (currentlyOpened) {
    await clearEntryOpened(feedId, entryId);
  } else {
    await markEntryOpened(feedId, entryId);
  }
  await loadFeeds();
}

export { feeds, loadFeeds, toggleEntryRead };
