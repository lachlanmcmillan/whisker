import { createSignal, onMount, Show, For } from "solid-js";
import type { Feed } from "./models/feed.model";
import { EntryItem } from "./components/EntryItem";
import { Button } from "./components/Button";
import { Title } from "./components/Title";
import { AddFeedPopover } from "./components/AddFeedPopover";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { readAllFeeds } from "./models/feed.model";
import { refreshFeed } from "./lib/feed/addNewFeed";
import styles from "./App.module.css";

function App() {
  const [feeds, setFeeds] = createSignal<Feed[]>([]);
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const [view, setView] = createSignal<"feeds" | "explorer">("feeds");

  const refreshFeeds = async () => {
    const result = await readAllFeeds();
    if (result.data) {
      setFeeds(result.data);
    }
    return result;
  };

  const handleFeedAdded = async () => {
    const result = await refreshFeeds();
    if (result.data) {
      setActiveIndex(result.data.length - 1);
    }
  };

  const handleRefresh = async () => {
    const feed = feeds()[activeIndex()];
    if (!feed?.feedUrl) return;

    setRefreshing(true);
    const result = await refreshFeed(feed.feedUrl);
    setRefreshing(false);

    if (result.error) {
      console.error("[handleRefresh]", result.error);
      return;
    }

    await refreshFeeds();
  };

  onMount(async () => {
    await refreshFeeds();
    setLoading(false);
  });

  return (
    <Show
      when={!loading()}
      fallback={<div class={styles.feed}>Loading feeds...</div>}
    >
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
                <AddFeedPopover onAdded={handleFeedAdded} />
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
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing() || !feed().feedUrl}
                >
                  {refreshing() ? "Refreshing..." : "Refresh"}
                </Button>
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
