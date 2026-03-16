import { Show, For } from "solid-js";
import type { Feed, FeedEntry } from "../models/feed.model";
import { markEntryOpened } from "../models/feed.model";
import { CachedThumbnail } from "./CachedThumbnail";
import { timeAgo } from "../lib/timeAgo";
import styles from "./gridView.module.css";

interface GridEntry {
  entry: FeedEntry;
  feedTitle: string;
}

function flattenAndSort(feeds: Feed[]): GridEntry[] {
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

export function GridView(props: { feeds: Feed[] }) {
  const items = () => flattenAndSort(props.feeds);

  return (
    <ul class={styles.grid}>
      <For each={items()}>
        {(item) => (
          <li class={styles.item} data-entry-id={item.entry.entryId} data-opened-at={item.entry.openedAt}>
            <a
              href={item.entry.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => item.entry.feedId && markEntryOpened(item.entry.feedId, item.entry.entryId)}
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
                  onClick={() => item.entry.feedId && markEntryOpened(item.entry.feedId, item.entry.entryId)}
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
