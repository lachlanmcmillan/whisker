import { For } from "solid-js";
import { Button } from "$components/Button/Button";
import { feeds, removeFeed } from "$stores/feeds.store";
import styles from "./FeedManager.module.css";

export function FeedManager() {
  return (
    <table class={styles.table}>
      <thead>
        <tr>
          <th>Title</th>
          <th>Author</th>
          <th>Entries</th>
          <th>Feed URL</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <For each={[...feeds]}>
          {feed => (
            <tr>
              <td>
                <a href={feed.link} target="_blank" rel="noopener">
                  {feed.title}
                </a>
              </td>
              <td>{feed.author}</td>
              <td>{feed.entries.length}</td>
              <td class={styles.feedUrl}>{feed.feedUrl}</td>
              <td class={styles.actions}>
                <Button onClick={() => removeFeed(feed.id)}>Remove</Button>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
