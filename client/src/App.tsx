import { createSignal, onMount, Show, For } from "solid-js";
import { EntryItem } from "$components/EntryItem/EntryItem";
import { Button } from "$components/Button/Button";
import { FeedHeader } from "$components/FeedHeader/FeedHeader";
import { AddFeedPopover } from "$components/AddFeedPopover/AddFeedPopover";
import { GridView } from "$components/GridView/GridView";
import { LoginForm } from "$components/LoginForm/LoginForm";
import { FeedManager } from "$components/FeedManager/FeedManager";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { getApiKey, setOnUnauthorized, refreshFeed } from "$lib/api";
import { feeds, loadFeeds } from "$stores/feeds.store";
import { appSettingsStore } from "$stores/settings.store";
import styles from "./App.module.css";

function App() {
  const [authenticated, setAuthenticated] = createSignal(!!getApiKey());
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [loading, setLoading] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshError, setRefreshError] = createSignal<string | null>(null);
  const [view, setView] = createSignal<"feeds" | "manager" | "explorer">("feeds");
  const [appSettings, setAppSettings] = appSettingsStore;

  setOnUnauthorized(() => setAuthenticated(false));

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

  const handleLogin = async () => {
    setAuthenticated(true);
    setLoading(true);
    await loadFeeds();
    setLoading(false);
  };

  onMount(async () => {
    if (!authenticated()) return;
    await loadFeeds();
    setLoading(false);
  });

  return (
    <Show when={authenticated()} fallback={<LoginForm onLogin={handleLogin} />}>
    <Show
      when={!loading()}
      fallback={<div class={styles.feed}>Loading feeds...</div>}
    >
      <header class={styles.header}>
        <h1 class={styles.brand}>Whisker</h1>
        <div class={styles.headerActions}>
          <Show when={view() !== "feeds"}>
            <Button onClick={() => setView("feeds")}>Feeds</Button>
          </Show>
          <Show when={view() === "feeds"}>
            <AddFeedPopover onAdded={handleFeedAdded} />
            <Button onClick={() => setView("manager")}>Manage</Button>
            <span class={styles.divider} />
            <Button onClick={() => setView("explorer")}>DB Explorer</Button>
          </Show>
        </div>
      </header>

      <Show when={view() === "manager"}>
        <div class={styles.feed}>
          <FeedManager />
        </div>
      </Show>

      <Show when={view() === "explorer"}>
        <DatabaseExplorer />
      </Show>

      <Show when={view() === "feeds"}>
        <div class={styles.feed}>
          <Show
            when={appSettings.layout === "Grid"}
            fallback={
              <>
                <div class={styles.toolbar}>
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

                <Show when={activeIndex() >= 0 && feeds[activeIndex()]}>
                  {feed => (
                    <div>
                      <FeedHeader feed={feed()} />
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
    </Show>
  );
}

export default App;
