import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import { Button } from "$components/Button/Button";
import { EditFeedDialog } from "$components/EditFeedDialog/EditFeedDialog";
import { FeedAvatar } from "$components/FeedAvatar/FeedAvatar";
import { Icon } from "$components/Icon/Icon";
import {
  formatInterval,
  PRESETS,
  RefreshIntervalSelect,
} from "$components/RefreshIntervalSelect/RefreshIntervalSelect";
import { TagPicker } from "$components/TagPicker/TagPicker";
import { timeAgo } from "$lib/timeAgo";
import { tagColor } from "$lib/tagHue";
import {
  feeds,
  tags,
  loadTags,
  removeFeeds,
  refreshFeedNow,
  importFeeds,
  attachTag,
  detachTag,
  setRefreshInterval,
  renameTagById,
  removeTag,
} from "$stores/feeds.store";
import type { Feed, Tag } from "$lib/api";
import styles from "./FeedManager.module.css";

type Tab = "feeds" | "tags";
type SortKey = "title" | "entries" | "fetchedAt";

const lastRefreshedFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function FeedManager() {
  const [tab, setTab] = createSignal<Tab>("feeds");
  const [tagFilter, setTagFilter] = createSignal<number | "all">("all");

  onMount(() => void loadTags());

  const showFeedsForTag = (tagId: number) => {
    setTagFilter(tagId);
    setTab("feeds");
  };

  return (
    <>
      <div class={styles.tabs}>
        <button
          class={`${styles.tab} ${tab() === "feeds" ? styles.tabActive : ""}`}
          onClick={() => setTab("feeds")}
        >
          Feeds <span class={styles.tabCount}>{feeds.length}</span>
        </button>
        <button
          class={`${styles.tab} ${tab() === "tags" ? styles.tabActive : ""}`}
          onClick={() => setTab("tags")}
        >
          Tags <span class={styles.tabCount}>{tags.length}</span>
        </button>
      </div>
      <Show when={tab() === "feeds"}>
        <FeedsTab tagFilter={tagFilter()} onTagFilterChange={setTagFilter} />
      </Show>
      <Show when={tab() === "tags"}>
        <TagsTab onShowFeeds={showFeedsForTag} />
      </Show>
    </>
  );
}

interface FeedsTabProps {
  tagFilter: number | "all";
  onTagFilterChange: (tagId: number | "all") => void;
}

function FeedsTab(props: FeedsTabProps) {
  const [search, setSearch] = createSignal("");
  const [sortKey, setSortKey] = createSignal<SortKey>("title");
  const [sortDir, setSortDir] = createSignal<1 | -1>(1);
  const [selected, setSelected] = createSignal<Set<number>>(new Set());
  const [editingFeed, setEditingFeed] = createSignal<Feed | null>(null);
  const [importing, setImporting] = createSignal(false);
  const [toolbarError, setToolbarError] = createSignal<string | null>(null);
  let fileInput!: HTMLInputElement;

  const visibleFeeds = createMemo(() => {
    const q = search().trim().toLowerCase();
    const tagId = props.tagFilter;
    const items = [...feeds].filter(f => {
      if (tagId !== "all" && !f.tags.some(t => t.id === tagId)) return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.author.toLowerCase().includes(q) ||
        f.feedUrl.toLowerCase().includes(q) ||
        f.tags.some(t => t.name.includes(q))
      );
    });
    const dir = sortDir();
    return items.sort((a, b) => {
      switch (sortKey()) {
        case "title":
          return dir * a.title.localeCompare(b.title);
        case "entries":
          return dir * (a.entries.length - b.entries.length);
        case "fetchedAt":
          return dir * (a.fetchedAt ?? "").localeCompare(b.fetchedAt ?? "");
      }
    });
  });

  // Drop selections for feeds that no longer exist (e.g. after removal).
  createEffect(() => {
    const ids = new Set(feeds.map(f => f.id));
    const current = selected();
    if ([...current].some(id => !ids.has(id))) {
      setSelected(new Set([...current].filter(id => ids.has(id))));
    }
  });

  const selectedFeeds = () => feeds.filter(f => selected().has(f.id));
  const allVisibleSelected = () =>
    visibleFeeds().length > 0 &&
    visibleFeeds().every(f => selected().has(f.id));
  const someVisibleSelected = () =>
    visibleFeeds().some(f => selected().has(f.id));

  const toggleSelected = (id: number) => {
    const next = new Set(selected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAllVisible = () => {
    const next = new Set(selected());
    if (allVisibleSelected()) visibleFeeds().forEach(f => next.delete(f.id));
    else visibleFeeds().forEach(f => next.add(f.id));
    setSelected(next);
  };

  const sortBy = (key: SortKey) => {
    if (sortKey() === key) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === "title" ? 1 : -1);
    }
  };

  const exportFeedList = () => {
    const urls = feeds.map(f => f.feedUrl).join("\n");
    const blob = new Blob([urls], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feeds.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFeedList = async (file: File) => {
    const urls = (await file.text())
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      setToolbarError("That file has no feed URLs in it");
      return;
    }
    setToolbarError(null);
    setImporting(true);
    try {
      await importFeeds(urls);
    } catch (e) {
      setToolbarError(errorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  const runBulk = async (action: () => Promise<void>) => {
    setToolbarError(null);
    try {
      await action();
    } catch (e) {
      setToolbarError(errorMessage(e));
    }
  };

  const bulkRemove = () => {
    const ids = [...selected()];
    const noun = ids.length === 1 ? "feed" : "feeds";
    if (!confirm(`Remove ${ids.length} ${noun} and all their entries?`)) return;
    void runBulk(() => removeFeeds(ids));
  };

  const selectedTags = () => {
    const map = new Map<number, Tag>();
    for (const f of selectedFeeds()) for (const t of f.tags) map.set(t.id, t);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  };

  const sortIndicator = (key: SortKey) =>
    sortKey() === key ?
      sortDir() === 1 ?
        " ↑"
      : " ↓"
    : "";

  const importButton = () => (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".txt,text/plain"
        hidden
        onChange={e => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void importFeedList(file);
        }}
      />
      <Button onClick={() => fileInput.click()} disabled={importing()}>
        {importing() ? "Importing…" : "Import feed list"}
      </Button>
    </>
  );

  return (
    <Show
      when={feeds.length > 0}
      fallback={
        <div class={styles.emptyState}>
          <p class={styles.emptyTitle}>No feeds yet</p>
          <p class={styles.emptyText}>
            Add a feed from your reading queue, or import a text file with one
            feed URL per line.
          </p>
          {importButton()}
          <Show when={toolbarError()}>
            {msg => <p class={styles.error}>{msg()}</p>}
          </Show>
        </div>
      }
    >
      <div class={styles.toolbar}>
        <div class={styles.searchBox}>
          <Icon name="search" size={13} />
          <input
            type="search"
            placeholder="Search feeds"
            value={search()}
            onInput={e => setSearch(e.currentTarget.value)}
          />
        </div>
        <select
          class={styles.select}
          value={props.tagFilter.toString()}
          onChange={e => {
            const v = e.currentTarget.value;
            props.onTagFilterChange(v === "all" ? "all" : Number(v));
          }}
        >
          <option value="all">All tags</option>
          <For each={[...tags]}>
            {tag => <option value={tag.id}>{tag.name}</option>}
          </For>
        </select>
        <div class={styles.toolbarEnd}>
          {importButton()}
          <Button onClick={exportFeedList}>Export feed list</Button>
        </div>
      </div>

      <Show when={toolbarError()}>
        {msg => <p class={styles.error}>{msg()}</p>}
      </Show>

      <Show when={selected().size > 0}>
        <div class={styles.bulkBar}>
          <span class={styles.bulkCount}>{selected().size} selected</span>
          <TagPicker
            trigger={
              <>
                <Icon name="plus" size={12} /> Add tag
              </>
            }
            triggerClass={styles.bulkBtn}
            onPick={name =>
              void runBulk(() => attachTag([...selected()], name))
            }
          />
          <Show when={selectedTags().length > 0}>
            <select
              class={styles.select}
              value=""
              onChange={e => {
                const tagId = Number(e.currentTarget.value);
                e.currentTarget.value = "";
                void runBulk(() => detachTag([...selected()], tagId));
              }}
            >
              <option value="" disabled selected>
                Remove tag…
              </option>
              <For each={selectedTags()}>
                {tag => <option value={tag.id}>{tag.name}</option>}
              </For>
            </select>
          </Show>
          <select
            class={styles.select}
            value=""
            onChange={e => {
              const v = e.currentTarget.value;
              e.currentTarget.value = "";
              const mins = v === "off" ? null : Number(v);
              void runBulk(() => setRefreshInterval([...selected()], mins));
            }}
          >
            <option value="" disabled selected>
              Auto refresh…
            </option>
            <option value="off">Off</option>
            <For each={PRESETS}>
              {mins => <option value={mins}>{formatInterval(mins)}</option>}
            </For>
          </select>
          <button
            class={`${styles.bulkBtn} ${styles.danger}`}
            onClick={bulkRemove}
          >
            Remove feeds
          </button>
          <button
            class={styles.bulkClear}
            onClick={() => setSelected(new Set<number>())}
          >
            Clear selection
          </button>
        </div>
      </Show>

      <table class={styles.table}>
        <thead>
          <tr>
            <th class={styles.checkCol}>
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allVisibleSelected()}
                ref={el =>
                  createEffect(() => {
                    el.indeterminate =
                      someVisibleSelected() && !allVisibleSelected();
                  })
                }
                onChange={toggleAllVisible}
              />
            </th>
            <th>
              <button class={styles.sortBtn} onClick={() => sortBy("title")}>
                Feed{sortIndicator("title")}
              </button>
            </th>
            <th class={styles.numCol}>
              <button class={styles.sortBtn} onClick={() => sortBy("entries")}>
                Entries{sortIndicator("entries")}
              </button>
            </th>
            <th>Tags</th>
            <th>Auto refresh</th>
            <th>
              <button
                class={styles.sortBtn}
                onClick={() => sortBy("fetchedAt")}
              >
                Last refreshed{sortIndicator("fetchedAt")}
              </button>
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          <For
            each={visibleFeeds()}
            fallback={
              <tr>
                <td colSpan={7} class={styles.noMatches}>
                  No feeds match.
                </td>
              </tr>
            }
          >
            {feed => (
              <FeedRow
                feed={feed}
                selected={selected().has(feed.id)}
                onToggleSelected={() => toggleSelected(feed.id)}
                onEdit={() => setEditingFeed(feed)}
              />
            )}
          </For>
        </tbody>
      </table>

      <Show when={editingFeed()}>
        {feed => (
          <EditFeedDialog feed={feed()} onClose={() => setEditingFeed(null)} />
        )}
      </Show>
    </Show>
  );
}

interface FeedRowProps {
  feed: Feed;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
}

function FeedRow(props: FeedRowProps) {
  const [error, setError] = createSignal<string | null>(null);
  const [refreshing, setRefreshing] = createSignal(false);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await run(() => refreshFeedNow(props.feed.id));
    setRefreshing(false);
  };

  const remove = () => {
    if (!confirm(`Remove "${props.feed.title}" and all its entries?`)) return;
    void run(() => removeFeeds([props.feed.id]));
  };

  const lastRefreshed = () =>
    props.feed.fetchedAt ?
      {
        label: timeAgo(props.feed.fetchedAt),
        title: lastRefreshedFormatter.format(new Date(props.feed.fetchedAt)),
      }
    : { label: "Never", title: "Feed has not been refreshed yet" };

  return (
    <tr classList={{ [styles.rowSelected]: props.selected }}>
      <td class={styles.checkCol}>
        <input
          type="checkbox"
          aria-label={`Select ${props.feed.title}`}
          checked={props.selected}
          onChange={props.onToggleSelected}
        />
      </td>
      <td>
        <div class={styles.feedCell}>
          <FeedAvatar feed={props.feed} size={28} />
          <div class={styles.feedInfo}>
            <div class={styles.feedTitleLine}>
              <a
                class={styles.feedTitle}
                href={props.feed.link}
                target="_blank"
                rel="noopener"
              >
                {props.feed.title}
              </a>
              <Show
                when={
                  props.feed.author && props.feed.author !== props.feed.title
                }
              >
                <span class={styles.feedAuthor}>{props.feed.author}</span>
              </Show>
            </div>
            <div class={styles.feedUrl} title={props.feed.feedUrl}>
              {props.feed.feedUrl}
            </div>
            <Show when={error()}>
              {msg => <p class={styles.error}>{msg()}</p>}
            </Show>
          </div>
        </div>
      </td>
      <td class={styles.numCol}>{props.feed.entries.length}</td>
      <td>
        <div class={styles.tagsCell}>
          <For each={props.feed.tags}>
            {tag => (
              <span class={styles.tagChip}>
                <span
                  class={styles.tagDot}
                  style={{ background: tagColor(tag.name) }}
                />
                {tag.name}
                <button
                  type="button"
                  class={styles.tagRemove}
                  onClick={() =>
                    void run(() => detachTag([props.feed.id], tag.id))
                  }
                  aria-label={`Remove tag ${tag.name}`}
                >
                  ×
                </button>
              </span>
            )}
          </For>
          <TagPicker
            trigger={<Icon name="plus" size={11} />}
            triggerLabel="Add tag"
            exclude={props.feed.tags.map(t => t.id)}
            onPick={name => void run(() => attachTag([props.feed.id], name))}
          />
        </div>
      </td>
      <td>
        <RefreshIntervalSelect
          value={props.feed.refreshIntervalMins}
          onChange={mins =>
            void run(() => setRefreshInterval([props.feed.id], mins))
          }
        />
      </td>
      <td class={styles.lastRefreshed} title={lastRefreshed().title}>
        {refreshing() ? "Refreshing…" : lastRefreshed().label}
      </td>
      <td class={styles.actionsCol}>
        <RowMenu
          label={`Actions for ${props.feed.title}`}
          items={[
            { label: "Edit", onSelect: props.onEdit },
            { label: "Refresh now", onSelect: () => void refresh() },
            { label: "Remove", onSelect: remove, danger: true },
          ]}
        />
      </td>
    </tr>
  );
}

interface RowMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

function RowMenu(props: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = createSignal(false);

  return (
    <div
      class={styles.menuWrapper}
      onKeyDown={e => e.key === "Escape" && setOpen(false)}
    >
      <button
        class={styles.menuBtn}
        aria-label={props.label}
        title="Actions"
        onClick={() => setOpen(o => !o)}
      >
        ⋯
      </button>
      <Show when={open()}>
        <div class={styles.menuBackdrop} onClick={() => setOpen(false)} />
        <div class={styles.menuPanel} role="menu">
          <For each={props.items}>
            {item => (
              <button
                role="menuitem"
                class={`${styles.menuItem} ${item.danger ? styles.danger : ""}`}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

function TagsTab(props: { onShowFeeds: (tagId: number) => void }) {
  const feedsByTag = createMemo(() => {
    const map = new Map<number, Feed[]>();
    for (const f of feeds) {
      for (const t of f.tags) {
        const list = map.get(t.id) ?? [];
        list.push(f);
        map.set(t.id, list);
      }
    }
    return map;
  });

  return (
    <Show
      when={tags.length > 0}
      fallback={
        <div class={styles.emptyState}>
          <p class={styles.emptyTitle}>No tags yet</p>
          <p class={styles.emptyText}>
            Add tags to your feeds from the Feeds tab to group them.
          </p>
        </div>
      }
    >
      <table class={styles.table}>
        <thead>
          <tr>
            <th>Tag</th>
            <th class={styles.numCol}>Feeds</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <For each={[...tags]}>
            {tag => (
              <TagRow
                tag={tag}
                feeds={feedsByTag().get(tag.id) ?? []}
                onShowFeeds={() => props.onShowFeeds(tag.id)}
              />
            )}
          </For>
        </tbody>
      </table>
    </Show>
  );
}

interface TagRowProps {
  tag: Tag;
  feeds: Feed[];
  onShowFeeds: () => void;
}

function TagRow(props: TagRowProps) {
  const [renaming, setRenaming] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const startRename = () => {
    setDraft(props.tag.name);
    setError(null);
    setRenaming(true);
  };

  const saveRename = async () => {
    const name = draft().trim();
    if (!name || name.toLowerCase() === props.tag.name) {
      setRenaming(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await renameTagById(props.tag.id, name);
      setRenaming(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const count = props.feeds.length;
    const message =
      count === 0 ?
        `Delete the tag "${props.tag.name}"?`
      : `Delete the tag "${props.tag.name}"? It will be removed from ${count} ${
          count === 1 ? "feed" : "feeds"
        }:\n\n${props.feeds.map(f => `• ${f.title}`).join("\n")}`;
    if (!confirm(message)) return;
    setError(null);
    try {
      await removeTag(props.tag.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const feedCountLabel = () =>
    `${props.feeds.length} ${props.feeds.length === 1 ? "feed" : "feeds"}`;

  return (
    <tr>
      <td>
        <Show
          when={renaming()}
          fallback={
            <button class={styles.tagLink} onClick={props.onShowFeeds}>
              <span
                class={styles.tagDot}
                style={{ background: tagColor(props.tag.name) }}
              />
              {props.tag.name}
            </button>
          }
        >
          <input
            class={styles.renameInput}
            value={draft()}
            maxLength={32}
            disabled={saving()}
            onInput={e => setDraft(e.currentTarget.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveRename();
              } else if (e.key === "Escape") {
                setRenaming(false);
              }
            }}
            ref={el => queueMicrotask(() => el.select())}
          />
        </Show>
        <Show when={error()}>{msg => <p class={styles.error}>{msg()}</p>}</Show>
      </td>
      <td class={styles.numCol}>
        <Show when={props.feeds.length > 0} fallback={feedCountLabel()}>
          <button class={styles.countLink} onClick={props.onShowFeeds}>
            {feedCountLabel()}
          </button>
        </Show>
      </td>
      <td class={styles.actionsCol}>
        <Show
          when={renaming()}
          fallback={
            <div class={styles.tagActions}>
              <Button onClick={startRename}>Rename</Button>
              <Button onClick={() => void remove()}>Delete</Button>
            </div>
          }
        >
          <div class={styles.tagActions}>
            <Button onClick={() => void saveRename()} disabled={saving()}>
              {saving() ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setRenaming(false)}
              disabled={saving()}
            >
              Cancel
            </Button>
          </div>
        </Show>
      </td>
    </tr>
  );
}
