import { Show, For } from "solid-js";
import type { FeedEntry } from "$lib/api";
import { CachedThumbnail } from "$components/CachedThumbnail/CachedThumbnail";
import { CheckButton } from "$components/CheckButton/CheckButton";
import { timeAgo } from "$lib/timeAgo";
import { feeds, toggleEntryRead } from "$stores/feeds.store";
import styles from "./gridView.module.css";

interface GridEntry {
  entry: FeedEntry;
  feedTitle: string;
}

function flattenAndSort(
  feeds: readonly { title: string; entries: readonly FeedEntry[] }[]
): GridEntry[] {
  const items: GridEntry[] = [];
  for (const feed of feeds) {
    for (const entry of feed.entries) {
      items.push({ entry, feedTitle: feed.title });
    }
  }
  items.sort(
    (a, b) =>
      new Date(b.entry.published).getTime() -
      new Date(a.entry.published).getTime()
  );
  return items;
}

export function GridView() {
  const items = () => flattenAndSort(feeds);

  return (
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
                when={item.entry.thumbnail}
                fallback={<div class={styles.placeholder} />}
              >
                <CachedThumbnail
                  url={item.entry.thumbnail!}
                  alt={item.entry.title}
                  class={styles.thumbnail}
                />
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
  );
}
