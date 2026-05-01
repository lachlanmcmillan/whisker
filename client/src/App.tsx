import { createMemo, createSignal, For, Show, onMount } from "solid-js";
import type { Feed, FeedEntry, Tag } from "$lib/api";
import { addFeed, getApiKey, refreshFeed, setOnUnauthorized } from "$lib/api";
import { Icon } from "$components/Icon/Icon";
import { FeedAvatar } from "$components/FeedAvatar/FeedAvatar";
import { Sidebar, type FilterMode } from "$components/Sidebar/Sidebar";
import { EntryCard } from "$components/EntryCard/EntryCard";
import { EntryListRow } from "$components/EntryListRow/EntryListRow";
import { LoginForm } from "$components/LoginForm/LoginForm";
import { FeedManager } from "$components/FeedManager/FeedManager";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { feeds, loadFeeds } from "$stores/feeds.store";
import { appSettingsStore } from "$stores/settings.store";
import styles from "./App.module.css";

type View = "feeds" | "manager" | "explorer";

interface EntryWithFeed {
  entry: FeedEntry;
  feed: Feed;
}

function isUnread(entry: FeedEntry): boolean {
  return !entry.openedAt && !entry.archivedAt;
}

function App() {
  const [authenticated, setAuthenticated] = createSignal(!!getApiKey());
  const [loading, setLoading] = createSignal(true);
  const [view, setView] = createSignal<View>("feeds");
  const [tagId, setTagId] = createSignal<number | "all">("all");
  const [feedId, setFeedId] = createSignal<number | null>(null);
  const [filter, setFilter] = createSignal<FilterMode>("all");
  const [appSettings, setAppSettings] = appSettingsStore;
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshError, setRefreshError] = createSignal<string | null>(null);

  setOnUnauthorized(() => setAuthenticated(false));

  const allEntries = createMemo<EntryWithFeed[]>(() =>
    [...feeds].flatMap(f => f.entries.map(entry => ({ entry, feed: f })))
  );

  const totalCount = () => allEntries().length;
  const unreadCount = () => allEntries().filter(({ entry }) => isUnread(entry)).length;

  const tagsWithCounts = createMemo(() => {
    const tagMap = new Map<number, { tag: Tag; count: number }>();
    for (const f of feeds) {
      for (const t of f.tags) {
        const existing = tagMap.get(t.id);
        if (existing) {
          existing.count += f.entries.length;
        } else {
          tagMap.set(t.id, { tag: t, count: f.entries.length });
        }
      }
    }
    return [...tagMap.values()]
      .map(({ tag, count }) => ({ tag, count, hue: tagHueFromName(tag.name) }))
      .sort((a, b) => a.tag.name.localeCompare(b.tag.name));
  });

  const activeTag = () => {
    const id = tagId();
    if (id === "all") return null;
    return tagsWithCounts().find(t => t.tag.id === id) ?? null;
  };

  const activeFeed = () => {
    const id = feedId();
    return id !== null ? [...feeds].find(f => f.id === id) ?? null : null;
  };

  const visibleEntries = createMemo<EntryWithFeed[]>(() => {
    let items = allEntries();
    const fid = feedId();
    if (fid !== null) {
      items = items.filter(({ feed }) => feed.id === fid);
    } else if (tagId() !== "all") {
      const id = tagId() as number;
      items = items.filter(({ feed }) => feed.tags.some(t => t.id === id));
    }
    if (filter() === "unread") {
      items = items.filter(({ entry }) => isUnread(entry));
    }
    return items.sort(
      (a, b) =>
        new Date(b.entry.published).getTime() - new Date(a.entry.published).getTime()
    );
  });

  const handleSelectTag = (id: number | "all") => {
    setTagId(id);
    setFeedId(null);
    setView("feeds");
  };

  const handleSelectFeed = (id: number) => {
    setFeedId(id);
    setView("feeds");
  };

  const handleSelectAllInbox = () => {
    setFilter("all");
    setTagId("all");
    setFeedId(null);
    setView("feeds");
  };

  const handleSelectUnreadInbox = () => {
    setFilter("unread");
    setFeedId(null);
    setView("feeds");
  };

  const handleRefreshFeed = async () => {
    const f = activeFeed();
    if (!f) return;
    setRefreshError(null);
    setRefreshing(true);
    try {
      await refreshFeed(f.id);
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

  const handleFeedAdded = async () => {
    const data = await loadFeeds();
    const last = data[data.length - 1];
    if (last) setFeedId(last.id);
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
        fallback={<div class={styles.loading}>Loading feeds…</div>}
      >
        <div class={styles.root}>
          <Show when={sidebarOpen()}>
            <Sidebar
              tagId={tagId()}
              feedId={feedId()}
              filter={filter()}
              totalCount={totalCount()}
              unreadCount={unreadCount()}
              tagsWithCounts={tagsWithCounts()}
              onSelectAll={handleSelectAllInbox}
              onSelectUnread={handleSelectUnreadInbox}
              onSelectTag={id => handleSelectTag(id)}
              onSelectFeed={handleSelectFeed}
              onClose={() => setSidebarOpen(false)}
              onOpenManager={() => {
                setView("manager");
                setSidebarOpen(false);
              }}
              onOpenExplorer={() => {
                setView("explorer");
                setSidebarOpen(false);
              }}
            />
          </Show>

          <main class={styles.main}>
            <header class={styles.header}>
              <div class={styles.brand}>
                <button
                  class={styles.menuBtn}
                  onClick={() => setSidebarOpen(o => !o)}
                  aria-label="Toggle sidebar"
                >
                  <Icon name="menu" size={16} />
                </button>
                <button
                  class={styles.wordmarkBtn}
                  onClick={handleSelectAllInbox}
                  aria-label="Go to homepage"
                >
                  <Icon name="whisker" size={28} color="var(--accent)" />
                  <h1 class={styles.wordmark}>Whisker</h1>
                  <span class={styles.subdomain}>your reading queue</span>
                </button>
              </div>
              <div class={styles.headerActions}>
                <Show when={view() !== "feeds"}>
                  <button class={styles.searchBtn} onClick={() => setView("feeds")}>
                    ← Back to feeds
                  </button>
                </Show>
                <Show when={view() === "feeds"}>
                  <button class={styles.searchBtn} disabled>
                    <Icon name="search" size={13} /> Search feeds & posts
                    <span class={styles.kbd}>⌘K</span>
                  </button>
                  <AddFeedButton onAdded={handleFeedAdded} />
                </Show>
              </div>
            </header>

            <Show when={view() === "manager"}>
              <FeedManager />
            </Show>
            <Show when={view() === "explorer"}>
              <DatabaseExplorer />
            </Show>
            <Show when={view() === "feeds"}>
              <div class={styles.sectionLabel}>Browse by topic</div>
              <div class={styles.moodGrid}>
                <MoodTile
                  label="All"
                  count={totalCount()}
                  hue={65}
                  active={tagId() === "all" && feedId() === null}
                  onClick={() => handleSelectTag("all")}
                />
                <For each={tagsWithCounts()}>
                  {({ tag, count, hue }) => (
                    <MoodTile
                      label={tag.name}
                      count={count}
                      hue={hue}
                      active={tagId() === tag.id && feedId() === null}
                      onClick={() => handleSelectTag(tag.id)}
                    />
                  )}
                </For>
              </div>

              <div class={styles.sectionDivider}>
                <h2 class={styles.sectionH2}>
                  <span class={styles.h2Static}>Showing</span>
                  <button
                    class={`${styles.h2Toggle} ${
                      filter() === "all" ? styles.h2ToggleActive : ""
                    }`}
                    onClick={() => setFilter("all")}
                  >
                    All
                  </button>
                  <button
                    class={`${styles.h2Toggle} ${
                      filter() === "unread" ? styles.h2ToggleActive : ""
                    }`}
                    onClick={() => setFilter("unread")}
                  >
                    Unread
                    <span
                      class={`${styles.h2Badge} ${
                        filter() === "unread" ? styles.h2BadgeActive : ""
                      }`}
                    >
                      {unreadCount()}
                    </span>
                  </button>
                  <span class={styles.h2Static}>in</span>
                  <Show
                    when={activeFeed()}
                    fallback={<span>{activeTag()?.tag.name ?? "All"}</span>}
                  >
                    {f => (
                      <span class={styles.h2Feed}>
                        <FeedAvatar feed={f()} size={22} />
                        {f().title}
                      </span>
                    )}
                  </Show>
                  <span class={styles.sectionMeta}>
                    {visibleEntries().length} posts
                  </span>
                </h2>
                <div class={styles.toolGroup}>
                  <button
                    class={`${styles.segBtn} ${
                      appSettings.layout === "Grid" ? styles.segBtnActive : ""
                    }`}
                    onClick={() => setAppSettings("layout", "Grid")}
                  >
                    <Icon name="grid" size={12} /> Grid
                  </button>
                  <button
                    class={`${styles.segBtn} ${
                      appSettings.layout === "List" ? styles.segBtnActive : ""
                    }`}
                    onClick={() => setAppSettings("layout", "List")}
                  >
                    <Icon name="list" size={12} /> List
                  </button>
                </div>
              </div>

              <Show when={activeFeed()}>
                {f => (
                  <div class={styles.refreshBar}>
                    <button
                      class={styles.refreshBtn}
                      onClick={handleRefreshFeed}
                      disabled={refreshing()}
                    >
                      {refreshing() ? "Refreshing…" : `Refresh ${f().title}`}
                    </button>
                    <Show when={refreshError()}>
                      <span class={styles.error}>{refreshError()}</span>
                    </Show>
                  </div>
                )}
              </Show>

              <Show
                when={visibleEntries().length > 0}
                fallback={<div class={styles.empty}>No posts to show.</div>}
              >
                <Show
                  when={appSettings.layout === "Grid"}
                  fallback={
                    <div class={styles.list}>
                      <For each={visibleEntries()}>
                        {({ entry, feed }) => <EntryListRow entry={entry} feed={feed} />}
                      </For>
                    </div>
                  }
                >
                  <div class={styles.grid}>
                    <For each={visibleEntries()}>
                      {({ entry, feed }) => <EntryCard entry={entry} feed={feed} />}
                    </For>
                  </div>
                </Show>
              </Show>
            </Show>
          </main>
        </div>
      </Show>
    </Show>
  );
}

interface MoodTileProps {
  label: string;
  count: number;
  hue: number;
  active: boolean;
  onClick: () => void;
}

function MoodTile(props: MoodTileProps) {
  return (
    <button
      class={`${styles.moodTile} ${props.active ? styles.moodTileActive : ""}`}
      style={{ "--tile-hue": props.hue }}
      onClick={props.onClick}
    >
      <span class={styles.moodTileRow}>
        <span class={styles.moodDot} />
        <span class={styles.moodLabel}>{props.label}</span>
        <span class={styles.moodCount}>{props.count}</span>
      </span>
    </button>
  );
}

interface AddFeedButtonProps {
  onAdded: () => void;
}

function AddFeedButton(props: AddFeedButtonProps) {
  const [open, setOpen] = createSignal(false);
  const [url, setUrl] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const close = () => {
    setOpen(false);
    setUrl("");
    setError(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const value = url().trim();
    if (!value) return;
    setError(null);
    setSubmitting(true);
    try {
      await addFeed(value);
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSubmitting(false);
    close();
    props.onAdded();
  };

  return (
    <div class={styles.addFeedWrapper}>
      <button
        class={styles.btnPrimary}
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <Icon name="plus" size={14} /> Add Feed
      </button>
      <Show when={open()}>
        <div class={styles.popoverBackdrop} onClick={close} />
        <div class={styles.popoverPanel}>
          <form onSubmit={handleSubmit}>
            <input
              class={styles.popoverInput}
              type="url"
              placeholder="https://example.com/feed.xml"
              value={url()}
              onInput={e => {
                setUrl(e.currentTarget.value);
                setError(null);
              }}
              disabled={submitting()}
              autofocus
            />
            <Show when={error()}>
              {msg => <p class={styles.error}>{msg()}</p>}
            </Show>
            <div class={styles.popoverActions}>
              <button
                class={styles.btnPrimary}
                type="submit"
                disabled={submitting()}
              >
                {submitting() ? "Adding…" : "Add"}
              </button>
              <button
                class={styles.btnGhost}
                type="button"
                onClick={close}
                disabled={submitting()}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </Show>
    </div>
  );
}

function tagHueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export default App;
