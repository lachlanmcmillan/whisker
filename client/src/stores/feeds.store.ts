import { createStore, reconcile } from "solid-js/store";
import type { Feed, FeedEntry, Tag } from "$lib/api";
import {
  addFeeds,
  fetchFeeds,
  updateEntry,
  updateFeed,
  deleteFeed,
  refreshFeed,
  assignTagToFeeds,
  unassignTagFromFeeds,
  updateFeedsRefreshInterval,
  listTags,
  renameTag,
  deleteTag,
} from "$lib/api";
import { appSettingsStore } from "$stores/settings.store";

const [feeds, setFeeds] = createStore<Feed[]>([]);
const [tags, setTags] = createStore<Tag[]>([]);

function isEntryUnread(entry: FeedEntry): boolean {
  return !entry.openedAt && !entry.archivedAt;
}

function isEntryVisible(entry: FeedEntry): boolean {
  const [appSettings] = appSettingsStore;
  if (!appSettings.showUnreadOnly) return true;
  return isEntryUnread(entry);
}

function getUnreadEntryCount(feed: Pick<Feed, "entries">): number {
  return feed.entries.filter(isEntryUnread).length;
}

function getTotalUnreadEntryCount(currentFeeds: readonly Feed[]): number {
  return currentFeeds.reduce(
    (count, feed) => count + getUnreadEntryCount(feed),
    0
  );
}

async function loadFeeds() {
  const data = await fetchFeeds();
  setFeeds(reconcile(data, { key: "id", merge: false }));
  return data;
}

type EntryFlag = "openedAt" | "archivedAt" | "starredAt";

// Entry flags are applied locally first and rolled back if the request fails.
async function setEntryFlag(
  feedId: number,
  entryId: string,
  flag: EntryFlag,
  currentlySet: boolean
) {
  const value = currentlySet ? null : new Date().toISOString();
  const entry = feeds
    .find(f => f.id === feedId)
    ?.entries.find(e => e.entryId === entryId);
  const previous = entry?.[flag] ?? null;
  const setFlag = (v: string | null) =>
    setFeeds(
      f => f.id === feedId,
      "entries",
      e => e.entryId === entryId,
      flag,
      v
    );
  setFlag(value);

  try {
    await updateEntry(feedId, entryId, { [flag]: value });
  } catch (e) {
    setFlag(previous);
    throw e;
  }
}

function toggleEntryRead(
  feedId: number,
  entryId: string,
  currentlyOpened: boolean
) {
  return setEntryFlag(feedId, entryId, "openedAt", currentlyOpened);
}

function toggleEntryArchived(
  feedId: number,
  entryId: string,
  currentlyArchived: boolean
) {
  return setEntryFlag(feedId, entryId, "archivedAt", currentlyArchived);
}

function toggleEntryStarred(
  feedId: number,
  entryId: string,
  currentlyStarred: boolean
) {
  return setEntryFlag(feedId, entryId, "starredAt", currentlyStarred);
}

async function editFeed(
  feedId: number,
  data: Partial<
    Pick<
      Feed,
      | "title"
      | "description"
      | "author"
      | "image"
      | "link"
      | "refreshIntervalMins"
    >
  >
) {
  await updateFeed(feedId, data);
  await loadFeeds();
}

async function loadTags() {
  const data = await listTags();
  setTags(reconcile(data, { key: "id", merge: false }));
  return data;
}

async function removeFeeds(feedIds: number[]) {
  await Promise.all(feedIds.map(id => deleteFeed(id)));
  await loadFeeds();
}

async function refreshFeedNow(feedId: number) {
  await refreshFeed(feedId);
  await loadFeeds();
}

async function importFeeds(urls: string[]) {
  await addFeeds(urls);
  await loadFeeds();
}

const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name);

function updateFeedTags(feedIds: Set<number>, update: (tags: Tag[]) => Tag[]) {
  setFeeds(feed => feedIds.has(feed.id), "tags", update);
}

// Stands in for a new tag's id until the server assigns one.
let nextPendingTagId = -1;

// Tag changes are applied locally first and rolled back if the request fails.
async function attachTag(feedIds: number[], rawName: string) {
  const name = rawName.trim().toLowerCase();
  const existing = tags.find(t => t.name === name);
  const pending = existing ?? { id: nextPendingTagId--, name };
  const changed = new Set(
    feeds
      .filter(f => feedIds.includes(f.id) && !f.tags.some(t => t.name === name))
      .map(f => f.id)
  );
  if (changed.size === 0) return;
  updateFeedTags(changed, current => [...current, pending].sort(byName));

  try {
    const tag = await assignTagToFeeds(
      [...changed],
      existing ? { tagId: existing.id } : { name }
    );
    if (!existing) {
      updateFeedTags(changed, current =>
        current.map(t => (t.id === pending.id ? tag : t))
      );
      if (!tags.some(t => t.id === tag.id)) {
        setTags(current => [...current, tag].sort(byName));
      }
    }
  } catch (e) {
    updateFeedTags(changed, current =>
      current.filter(t => t.id !== pending.id)
    );
    throw e;
  }
}

async function detachTag(feedIds: number[], tagId: number) {
  const tag = feeds.flatMap(f => f.tags).find(t => t.id === tagId);
  const changed = new Set(
    feeds
      .filter(f => feedIds.includes(f.id) && f.tags.some(t => t.id === tagId))
      .map(f => f.id)
  );
  if (!tag || tagId < 0 || changed.size === 0) return;
  updateFeedTags(changed, current => current.filter(t => t.id !== tagId));

  try {
    await unassignTagFromFeeds([...changed], tagId);
  } catch (e) {
    updateFeedTags(changed, current => [...current, tag].sort(byName));
    throw e;
  }
}

async function setRefreshInterval(feedIds: number[], mins: number | null) {
  const previous = new Map(
    feeds
      .filter(f => feedIds.includes(f.id) && f.refreshIntervalMins !== mins)
      .map(f => [f.id, f.refreshIntervalMins])
  );
  if (previous.size === 0) return;
  setFeeds(f => previous.has(f.id), "refreshIntervalMins", mins);

  try {
    await updateFeedsRefreshInterval([...previous.keys()], mins);
  } catch (e) {
    for (const [id, value] of previous) {
      setFeeds(f => f.id === id, "refreshIntervalMins", value);
    }
    throw e;
  }
}

async function renameTagById(tagId: number, name: string) {
  await renameTag(tagId, name);
  await Promise.all([loadFeeds(), loadTags()]);
}

async function removeTag(tagId: number) {
  await deleteTag(tagId);
  await Promise.all([loadFeeds(), loadTags()]);
}

export {
  feeds,
  loadFeeds,
  editFeed,
  toggleEntryRead,
  toggleEntryArchived,
  toggleEntryStarred,
  tags,
  loadTags,
  removeFeeds,
  refreshFeedNow,
  importFeeds,
  attachTag,
  detachTag,
  setRefreshInterval,
  renameTagById,
  removeTag,
  isEntryVisible,
  getUnreadEntryCount,
  getTotalUnreadEntryCount,
};
