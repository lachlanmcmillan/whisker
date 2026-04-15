import { createSignal, For, Show } from "solid-js";
import { Button } from "$components/Button/Button";
import { EditFeedDialog } from "$components/EditFeedDialog/EditFeedDialog";
import { timeAgo } from "$lib/timeAgo";
import { feeds, removeFeed } from "$stores/feeds.store";
import type { Feed } from "$lib/api";
import styles from "./FeedManager.module.css";

export function FeedManager() {
  const [editingFeed, setEditingFeed] = createSignal<Feed | null>(null);
  const lastRefreshedFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function exportFeedList() {
    const urls = feeds.map(f => f.feedUrl).join("\n");
    const blob = new Blob([urls], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feeds.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatLastRefreshed(timestamp?: string) {
    if (!timestamp) return { label: "Never", title: "Feed has not been refreshed yet" };

    return {
      label: timeAgo(timestamp),
      title: lastRefreshedFormatter.format(new Date(timestamp)),
    };
  }

  return (
    <>
      <div class={styles.toolbar}>
        <Button onClick={exportFeedList}>Export feed list</Button>
      </div>
      <table class={styles.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Author</th>
            <th>Entries</th>
            <th>Last refreshed</th>
            <th>Feed URL</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <For each={[...feeds]}>
            {feed => {
              const lastRefreshed = formatLastRefreshed(feed.fetchedAt);

              return (
                <tr>
                  <td>
                    <a href={feed.link} target="_blank" rel="noopener">
                      {feed.title}
                    </a>
                  </td>
                  <td>{feed.author}</td>
                  <td>{feed.entries.length}</td>
                  <td class={styles.lastRefreshed} title={lastRefreshed.title}>
                    {lastRefreshed.label}
                  </td>
                  <td class={styles.feedUrl}>{feed.feedUrl}</td>
                  <td class={styles.actions}>
                    <Button onClick={() => setEditingFeed(feed)}>Edit</Button>
                    <Button onClick={() => removeFeed(feed.id)}>Remove</Button>
                  </td>
                </tr>
              );
            }}
          </For>
        </tbody>
      </table>
      <Show when={editingFeed()}>
        {feed => (
          <EditFeedDialog
            feed={feed()}
            onClose={() => setEditingFeed(null)}
          />
        )}
      </Show>
    </>
  );
}
