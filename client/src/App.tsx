import { createMemo, createSignal, For, Show, onMount } from "solid-js";
import type { Feed, FeedEntry, Tag } from "$lib/api";
import {
  addFeeds,
  currentUser,
  refreshFeed,
  setOnUnauthorized,
  type User,
} from "$lib/api";
import { tagHue } from "$lib/tagHue";
import { Icon } from "$components/Icon/Icon";
import { FeedAvatar } from "$components/FeedAvatar/FeedAvatar";
import { Sidebar, type FilterMode } from "$components/Sidebar/Sidebar";
import { EntryCard } from "$components/EntryCard/EntryCard";
import { EntryListRow } from "$components/EntryListRow/EntryListRow";
import { LoginForm } from "$components/LoginForm/LoginForm";
import { FeedManager } from "$components/FeedManager/FeedManager";
import { Account, AcceptAccount } from "./Account";
import { feeds, loadFeeds } from "$stores/feeds.store";
import { appSettingsStore } from "$stores/settings.store";
import { themeMode, toggleThemeMode } from "$stores/theme.store";
import styles from "./App.module.css";

type View = "feeds" | "manager" | "account";

interface EntryWithFeed {
  entry: FeedEntry;
  feed: Feed;
}

function isUnread(entry: FeedEntry): boolean {
  return !entry.openedAt && !entry.archivedAt;
}

function App() {
  const [user, setUser] = createSignal<User | null>(null);
  const [accountToken, setAccountToken] = createSignal(
    /^#(?:setup|invite|reset)=([A-Za-z0-9_-]+)$/.exec(location.hash)?.[1] ??
      null
  );
  const [loading, setLoading] = createSignal(true);
  const [view, setView] = createSignal<View>("feeds");
  const [tagId, setTagId] = createSignal<number | "all">("all");
  const [feedId, setFeedId] = createSignal<number | null>(null);
  const [filter, setFilter] = createSignal<FilterMode>("all");
  const [appSettings, setAppSettings] = appSettingsStore;
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshError, setRefreshError] = createSignal<string | null>(null);

  setOnUnauthorized(() => {
    setUser(null);
    setLoading(false);
  });

  const allEntries = createMemo<EntryWithFeed[]>(() =>
    [...feeds].flatMap(f => f.entries.map(entry => ({ entry, feed: f })))
  );

  const totalCount = () => allEntries().length;
  const unreadCount = () =>
    allEntries().filter(({ entry }) => isUnread(entry)).length;

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
      .map(({ tag, count }) => ({ tag, count, hue: tagHue(tag.name) }))
      .sort((a, b) => a.tag.name.localeCompare(b.tag.name));
  });

  const activeTag = () => {
    const id = tagId();
    if (id === "all") return null;
    return tagsWithCounts().find(t => t.tag.id === id) ?? null;
  };

  const activeFeed = () => {
    const id = feedId();
    return id !== null ? ([...feeds].find(f => f.id === id) ?? null) : null;
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
        new Date(b.entry.published).getTime() -
        new Date(a.entry.published).getTime()
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

  // Opening a feed from an entry swaps the whole list, so start at its top.
  const handleSelectFeedFromEntry = (id: number) => {
    handleSelectFeed(id);
    window.scrollTo({ top: 0 });
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
    setLoading(true);
    try {
      setUser(await currentUser());
      await loadFeeds();
    } finally {
      setLoading(false);
    }
  };

  const handleFeedAdded = async (count: number) => {
    const data = await loadFeeds();
    if (count > 1) {
      setFeedId(null);
      setTagId("all");
      setFilter("all");
      return;
    }
    const last = data[data.length - 1];
    if (last) setFeedId(last.id);
  };

  onMount(async () => {
    localStorage.removeItem("whisker_api_key");
    if (accountToken()) {
      setLoading(false);
      return;
    }
    try {
      setUser(await currentUser());
      await loadFeeds();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  });

  return (
    <Show
      when={!loading()}
      fallback={<div class={styles.loading}>Loading…</div>}
    >
      <Show
        when={user()}
        fallback={
          accountToken() ?
            <AcceptAccount
              token={accountToken()!}
              onAccepted={account => {
                setAccountToken(null);
                setUser(account);
                void loadFeeds();
              }}
            />
          : <LoginForm onLogin={() => void handleLogin()} />
        }
      >
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
                onOpenAccount={() => {
                  setView("account");
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
                    <h1 class={styles.wordmark}>Whisker</h1>
                    <span class={styles.subdomain}>your reading queue</span>
                  </button>
                </div>
                <div class={styles.headerActions}>
                  <button
                    class={styles.modeBtn}
                    onClick={toggleThemeMode}
                    title={
                      themeMode() === "dark" ? "Switch to light" : (
                        "Switch to dark"
                      )
                    }
                  >
                    <span class={styles.modeSwatch} />
                    {themeMode() === "dark" ? "Light" : "Dark"}
                  </button>
                  <Show when={view() !== "feeds"}>
                    <button
                      class={`${styles.searchBtn} ${styles.backBtn}`}
                      onClick={() => setView("feeds")}
                    >
                      ← Back to feeds
                    </button>
                  </Show>
                  <Show when={view() === "manager"}>
                    <AddFeedButton onAdded={() => void loadFeeds()} />
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
              <Show when={view() === "account" && user()}>
                <Account
                  user={user()!}
                  onLogout={() => {
                    setUser(null);
                    setView("feeds");
                  }}
                />
              </Show>
              <Show when={view() === "feeds"}>
                <div class={styles.sectionLabel}>Browse by topic</div>
                <div class={styles.moodGrid}>
                  <MoodTile
                    label="All"
                    count={totalCount()}
                    active={tagId() === "all" && feedId() === null}
                    onClick={() => handleSelectTag("all")}
                  />
                  <For each={tagsWithCounts()}>
                    {({ tag, count }) => (
                      <MoodTile
                        label={tag.name}
                        count={count}
                        active={tagId() === tag.id && feedId() === null}
                        onClick={() => handleSelectTag(tag.id)}
                      />
                    )}
                  </For>
                </div>

                <div class={styles.sectionDivider}>
                  <h2 class={styles.sectionH2}>
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
                  <div class={styles.tools}>
                    <div class={styles.toolGroup}>
                      <button
                        class={`${styles.segBtn} ${
                          filter() === "all" ? styles.segBtnActive : ""
                        }`}
                        onClick={() => setFilter("all")}
                      >
                        All
                      </button>
                      <button
                        class={`${styles.segBtn} ${
                          filter() === "unread" ? styles.segBtnActive : ""
                        }`}
                        onClick={() => setFilter("unread")}
                      >
                        Unread
                        <span
                          class={`${styles.segBadge} ${
                            filter() === "unread" ? styles.segBadgeActive : ""
                          }`}
                        >
                          {unreadCount()}
                        </span>
                      </button>
                    </div>
                    <div class={styles.toolGroup}>
                      <button
                        class={`${styles.segBtn} ${
                          appSettings.layout === "Grid" ?
                            styles.segBtnActive
                          : ""
                        }`}
                        onClick={() => setAppSettings("layout", "Grid")}
                      >
                        <Icon name="grid" size={12} /> Grid
                      </button>
                      <button
                        class={`${styles.segBtn} ${
                          appSettings.layout === "List" ?
                            styles.segBtnActive
                          : ""
                        }`}
                        onClick={() => setAppSettings("layout", "List")}
                      >
                        <Icon name="list" size={12} /> List
                      </button>
                    </div>
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
                          {({ entry, feed }) => (
                            <EntryListRow
                              entry={entry}
                              feed={feed}
                              onSelectFeed={handleSelectFeedFromEntry}
                            />
                          )}
                        </For>
                      </div>
                    }
                  >
                    <div class={styles.grid}>
                      <For each={visibleEntries()}>
                        {({ entry, feed }) => (
                          <EntryCard
                            entry={entry}
                            feed={feed}
                            onSelectFeed={handleSelectFeedFromEntry}
                          />
                        )}
                      </For>
                    </div>
                  </Show>
                </Show>
              </Show>
            </main>
          </div>
        </Show>
      </Show>
    </Show>
  );
}

interface MoodTileProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function MoodTile(props: MoodTileProps) {
  return (
    <button
      class={`${styles.moodTile} ${props.active ? styles.moodTileActive : ""}`}
      onClick={props.onClick}
    >
      <span class={styles.moodLabel}>{props.label}</span>
      <span class={styles.moodCount}>{props.count}</span>
    </button>
  );
}

interface AddFeedButtonProps {
  onAdded: (count: number) => void;
}

function AddFeedButton(props: AddFeedButtonProps) {
  const [open, setOpen] = createSignal(false);
  const [urls, setUrls] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const close = () => {
    setOpen(false);
    setUrls("");
    setError(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const lines = urls()
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      await addFeeds(lines);
    } catch (e) {
      setSubmitting(false);
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSubmitting(false);
    close();
    props.onAdded(lines.length);
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
            <textarea
              class={styles.popoverInput}
              rows={6}
              placeholder={
                "https://example.com/feed.xml\nhttps://another-site.com"
              }
              value={urls()}
              onInput={e => {
                setUrls(e.currentTarget.value);
                setError(null);
              }}
              disabled={submitting()}
              autofocus
            />
            <p class={styles.popoverHint}>
              One feed or website URL per line. All lines must be valid.
            </p>
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

export default App;
