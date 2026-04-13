import { createMemo, Show, For } from "solid-js";
import type { Feed, FeedEntry } from "$lib/api";
import { Button } from "$components/Button/Button";
import { FeedHeader } from "$components/FeedHeader/FeedHeader";
import { CachedThumbnail } from "$components/CachedThumbnail/CachedThumbnail";
import { CheckButton } from "$components/CheckButton/CheckButton";
import { timeAgo } from "$lib/timeAgo";
import { ArchiveButton } from "$components/ArchiveButton/ArchiveButton";
import { StarButton } from "$components/StarButton/StarButton";
import { feeds, toggleEntryRead, toggleEntryArchived, toggleEntryStarred, isEntryVisible } from "$stores/feeds.store";
import { appSettingsStore } from "$stores/settings.store";
import styles from "./gridView.module.css";

interface GridEntry {
  entry: FeedEntry;
  feedTitle: string;
  feedImage: string | null;
}

function flattenAndSort(
  feeds: readonly Feed[],
  filterFeedId: number | null
): GridEntry[] {
  const items: GridEntry[] = [];
  for (const feed of feeds) {
    if (filterFeedId !== null && feed.id !== filterFeedId) continue;
    for (const entry of feed.entries) {
      items.push({ entry, feedTitle: feed.title, feedImage: feed.image ?? null });
    }
  }
  items.sort(
    (a, b) =>
      new Date(b.entry.published).getTime() -
      new Date(a.entry.published).getTime()
  );
  return items;
}

interface GridViewProps {
  selectedFeedId: () => number | null;
  setSelectedFeedId: (id: number | null) => void;
}

export function GridView(props: GridViewProps) {
  const selectedFeedId = props.selectedFeedId;
  const setSelectedFeedId = props.setSelectedFeedId;
  const [appSettings, setAppSettings] = appSettingsStore;
  const items = () =>
    flattenAndSort(feeds, selectedFeedId()).filter(i => isEntryVisible(i.entry));
  const selectedFeed = createMemo(() => {
    const id = selectedFeedId();
    return id !== null ? [...feeds].find(f => f.id === id) ?? null : null;
  });

  return (
    <>
      <div class={styles.toolbar}>
        <nav class={styles.feedTabs}>
          <Button
            active={selectedFeedId() === null}
            onClick={() => setSelectedFeedId(null)}
          >
            All
          </Button>
          <For each={[...feeds]}>
            {f => (
              <Button
                active={selectedFeedId() === f.id}
                onClick={() => setSelectedFeedId(f.id)}
              >
                {f.title}
              </Button>
            )}
          </For>
        </nav>
        <Button
          active={appSettings.showUnreadOnly}
          onClick={() => setAppSettings("showUnreadOnly", !appSettings.showUnreadOnly)}
        >
          Unread
        </Button>
        <div class={styles.layoutToggle}>
          <Button
            active={appSettings.layout === "List"}
            onClick={() => setAppSettings("layout", "List")}
          >
            List
          </Button>
          <Button
            active={appSettings.layout === "Grid"}
            onClick={() => setAppSettings("layout", "Grid")}
          >
            Grid
          </Button>
        </div>
      </div>
      <Show when={selectedFeed()}>
        {feed => <FeedHeader feed={feed()} />}
      </Show>
      <ul class={styles.grid}>
        <For each={items()}>
          {item => (
            <li
              class={styles.item}
              data-entry-id={item.entry.entryId}
              data-opened-at={item.entry.openedAt}
            >
              <CheckButton
                checked={!!item.entry.openedAt}
                onClick={() => {
                  if (!item.entry.feedId) return;
                  toggleEntryRead(
                    item.entry.feedId,
                    item.entry.entryId,
                    !!item.entry.openedAt
                  );
                }}
              />
              <ArchiveButton
                archived={!!item.entry.archivedAt}
                onClick={() => {
                  if (!item.entry.feedId) return;
                  toggleEntryArchived(
                    item.entry.feedId,
                    item.entry.entryId,
                    !!item.entry.archivedAt
                  );
                }}
              />
              <StarButton
                starred={!!item.entry.starredAt}
                onClick={() => {
                  if (!item.entry.feedId) return;
                  toggleEntryStarred(
                    item.entry.feedId,
                    item.entry.entryId,
                    !!item.entry.starredAt
                  );
                }}
              />
              <a
                href={item.entry.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  item.entry.feedId &&
                  toggleEntryRead(item.entry.feedId, item.entry.entryId, false)
                }
              >
                <Show
                  when={item.entry.thumbnail ?? item.feedImage}
                  fallback={<div class={styles.placeholder} />}
                >
                  {url => (
                    <CachedThumbnail
                      url={url()}
                      alt={item.entry.title}
                      class={styles.thumbnail}
                    />
                  )}
                </Show>
              </a>
              <div class={styles.info}>
                <p class={styles.title}>
                  <a
                    href={item.entry.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      item.entry.feedId &&
                      toggleEntryRead(
                        item.entry.feedId,
                        item.entry.entryId,
                        false
                      )
                    }
                  >
                    {item.entry.title}
                  </a>
                </p>
                <p class={styles.feedName}>{item.feedTitle}</p>
                <p class={styles.time}>{timeAgo(item.entry.published)}</p>
                <Show when={item.entry.description}>
                  <p class={styles.description}>{item.entry.description}</p>
                </Show>
              </div>
            </li>
          )}
        </For>
      </ul>
    </>
  );
}
