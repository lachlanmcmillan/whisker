import { createSignal, onMount, Show, For } from "solid-js";
import { EntryItem } from "$components/EntryItem/EntryItem";
import { Button } from "$components/Button/Button";
import { Title } from "$components/Title/Title";
import { AddFeedPopover } from "$components/AddFeedPopover/AddFeedPopover";
import { GridView } from "$components/GridView/GridView";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { refreshFeed } from "$lib/api";
import { feeds, loadFeeds } from "$stores/feeds.store";
import { appSettingsStore } from "$stores/settings.store";
import styles from "./App.module.css";

function App() {
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshError, setRefreshError] = createSignal<string | null>(null);
  const [view, setView] = createSignal<"feeds" | "explorer">("feeds");
  const [appSettings, setAppSettings] = appSettingsStore;

  const allEntriesSorted = () =>
    [...feeds]
      .flatMap(f => f.entries)
      .sort(
        (a, b) =>
          new Date(b.published).getTime() - new Date(a.published).getTime()
      );

  const handleFeedAdded = async () => {
    const data = await loadFeeds();
    setActiveIndex(data.length - 1);
  };

  const handleRefreshFeed = async () => {
    const feed = feeds[activeIndex()];
    if (!feed?.id) return;

    setRefreshError(null);
    setRefreshing(true);
    try {
      await refreshFeed(feed.id);
      await loadFeeds();
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : String(e));
    }
    setRefreshing(false);
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
            <AddFeedPopover onAdded={handleFeedAdded} />
            <Button onClick={() => setView("explorer")}>DB Explorer</Button>
          </nav>

          <Show
            when={appSettings.layout === "Grid"}
            fallback={
              <>
                <nav class={styles.feedTabs}>
                  <Button
                    active={activeIndex() === -1}
                    onClick={() => {
                      setActiveIndex(-1);
                      setRefreshError(null);
                    }}
                  >
                    All
                  </Button>
                  <For each={[...feeds]}>
                    {(f, i) => (
                      <Button
                        active={i() === activeIndex()}
                        onClick={() => {
                          setActiveIndex(i());
                          setRefreshError(null);
                        }}
                      >
                        {f.title}
                      </Button>
                    )}
                  </For>
                </nav>

                <Show when={activeIndex() >= 0 && feeds[activeIndex()]}>
                  {feed => (
                    <div class={styles.feedHeader}>
                      <Title>{feed().title}</Title>
                      <p>
                        by {feed().author} —{" "}
                        {new Date(feed().published).toLocaleDateString()}
                      </p>
                      <Show when={feed().description}>
                        <p>{feed().description}</p>
                      </Show>
                      <Button onClick={handleRefreshFeed} disabled={refreshing()}>
                        {refreshing() ? "Refreshing..." : "Refresh"}
                      </Button>
                      <Show when={refreshError()}>
                        <p class={styles.error}>{refreshError()}</p>
                      </Show>
                    </div>
                  )}
                </Show>

                <ul class={styles.entries}>
                  <For
                    each={
                      activeIndex() === -1
                        ? allEntriesSorted()
                        : feeds[activeIndex()]?.entries ?? []
                    }
                  >
                    {entry => <EntryItem entry={entry} />}
                  </For>
                </ul>
              </>
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
