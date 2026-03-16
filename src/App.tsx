import { createSignal, onMount, Show, For } from "solid-js";
import { parseAtomFeed } from "./lib/atom/parse";
import { parseRssFeed } from "./lib/rss/parse";
import type { Feed } from "./models/feed.model";
import { EntryItem } from "./components/EntryItem";
import { Button } from "./components/Button";
import { Title } from "./components/Title";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { readAllFeeds, upsertFeed } from "./models/feed.model";
import atomXml from "../yt-asionometry.xml?raw";
import rssXml from "../substack-signull.xml?raw";
import styles from "./App.module.css";

function App() {
  const [feeds, setFeeds] = createSignal<Feed[]>([]);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [view, setView] = createSignal<"feeds" | "explorer">("feeds");

  onMount(async () => {
    let loaded = await readAllFeeds();

    if (loaded.length === 0) {
      await upsertFeed(parseAtomFeed(atomXml));
      await upsertFeed(parseRssFeed(rssXml));
      loaded = await readAllFeeds();
    }

    setFeeds(loaded);
    setLoading(false);
  });

  return (
    <Show when={!loading()} fallback={<div class={styles.feed}>Loading feeds...</div>}>
      <Show
        when={view() === "feeds"}
        fallback={
          <div>
            <div class={styles.feed}>
              <nav class={styles.tabs}>
                <Button onClick={() => setView("feeds")}>Back to Feeds</Button>
              </nav>
            </div>
            <DatabaseExplorer />
          </div>
        }
      >
        <Show when={feeds()[activeIndex()]}>
          {(feed) => (
            <div class={styles.feed}>
              <nav class={styles.tabs}>
                <For each={feeds()}>
                  {(f, i) => (
                    <Button
                      active={i() === activeIndex()}
                      onClick={() => setActiveIndex(i())}
                    >
                      {f.title}
                    </Button>
                  )}
                </For>
                <Button onClick={() => setView("explorer")}>DB Explorer</Button>
              </nav>

              <div class={styles.feedHeader}>
                <Title>{feed().title}</Title>
                <p>
                  by {feed().author} —{" "}
                  {new Date(feed().published).toLocaleDateString()}
                </p>
                <Show when={feed().description}>
                  <p>{feed().description}</p>
                </Show>
              </div>

              <ul class={styles.entries}>
                <For each={feed().entries}>
                  {(entry) => <EntryItem entry={entry} />}
                </For>
              </ul>
            </div>
          )}
        </Show>
      </Show>
    </Show>
  );
}

export default App;
