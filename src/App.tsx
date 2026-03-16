import { createSignal, onMount, Show, For } from "solid-js";
import { EntryItem } from "./components/EntryItem";
import { Button } from "./components/Button";
import { Title } from "./components/Title";
import { AddFeedPopover } from "./components/AddFeedPopover";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { GridView } from "./components/GridView";
import { refreshFeed } from "./lib/feed/addNewFeed";
import { feeds, loadFeeds } from "./stores/feeds.store";
import { appSettingsStore } from "./stores/settings.store";
import styles from "./App.module.css";

function App() {
  const [activeIndex, setActiveIndex] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshError, setRefreshError] = createSignal<string | null>(null);
  const [view, setView] = createSignal<"feeds" | "explorer">("feeds");
  const [appSettings, setAppSettings] = appSettingsStore;

  const handleFeedAdded = async () => {
    const result = await loadFeeds();
    if (result.data) {
      setActiveIndex(result.data.length - 1);
    }
  };

  const handleRefresh = async () => {
    const feed = feeds[activeIndex()];
    const url = feed?.feedUrl || feed?.link;
    if (!url) {
      setRefreshError("No feed URL available. Try removing and re-adding this feed.");
      return;
    }

    setRefreshError(null);
    setRefreshing(true);
    const result = await refreshFeed(url);
    setRefreshing(false);

    if (result.error) {
      console.error("[handleRefresh]", result.error);
      setRefreshError(result.error.message);
      return;
    }

    await loadFeeds();
  };

  onMount(async () => {
    await loadFeeds();
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
        <div class={styles.feed}>
          <nav class={styles.tabs}>
            <Button
              active={appSettings.layout === "List"}
              onClick={() => setAppSettings('layout', "List")}
            >
              List
            </Button>
            <Button
              active={appSettings.layout === "Grid"}
              onClick={() => setAppSettings('layout', "Grid")}
            >
              Grid
            </Button>
            <AddFeedPopover onAdded={handleFeedAdded} />
            <Button onClick={() => setView("explorer")}>DB Explorer</Button>
          </nav>

          <Show
            when={appSettings.layout === "Grid"}
            fallback={
              <Show when={feeds[activeIndex()]}>
                {(feed) => (
                  <>
                    <nav class={styles.feedTabs}>
                      <For each={[...feeds]}>
                        {(f, i) => (
                          <Button
                            active={i() === activeIndex()}
                            onClick={() => { setActiveIndex(i()); setRefreshError(null); }}
                          >
                            {f.title}
                          </Button>
                        )}
                      </For>
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
                        disabled={refreshing()}
                      >
                        {refreshing() ? "Refreshing..." : "Refresh"}
                      </Button>
                      <Show when={refreshError()}>
                        <p class={styles.error}>{refreshError()}</p>
                      </Show>
                    </div>

                    <ul class={styles.entries}>
                      <For each={feed().entries}>
                        {(entry) => <EntryItem entry={entry} />}
                      </For>
                    </ul>
                  </>
                )}
              </Show>
            }
          >
            <GridView />
          </Show>
        </div>
      </Show>
    </Show>
  );
}

export default App;
