import { createStore, reconcile } from "solid-js/store";
import type { Feed, FeedEntry, Tag } from "$lib/api";
import {
  addFeeds,
  fetchFeeds,
  updateEntry,
  updateFeed,
  deleteFeed,
  refreshFeed,
  assignTagToFeed,
  unassignTagFromFeed,
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

async function attachTag(feedIds: number[], name: string) {
  const [first, ...rest] = feedIds;
  if (first === undefined) return;
  // Assign by name once so the tag is created, then by id to avoid racing on creation.
  const tag = await assignTagToFeed(first, { name });
  await Promise.all(rest.map(id => assignTagToFeed(id, { tagId: tag.id })));
  await Promise.all([loadFeeds(), loadTags()]);
}

async function detachTag(feedIds: number[], tagId: number) {
  await Promise.all(feedIds.map(id => unassignTagFromFeed(id, tagId)));
  await loadFeeds();
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
  renameTagById,
  removeTag,
  isEntryVisible,
  getUnreadEntryCount,
  getTotalUnreadEntryCount,
};
