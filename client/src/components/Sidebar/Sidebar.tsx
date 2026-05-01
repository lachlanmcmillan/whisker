import { For, Show } from "solid-js";
import type { Tag } from "$lib/api";
import { Icon } from "$components/Icon/Icon";
import { FeedAvatar } from "$components/FeedAvatar/FeedAvatar";
import { feeds } from "$stores/feeds.store";
import styles from "./sidebar.module.css";

export type FilterMode = "all" | "unread";

interface SidebarProps {
  tagId: number | "all";
  feedId: number | null;
  filter: FilterMode;
  totalCount: number;
  unreadCount: number;
  tagsWithCounts: Array<{ tag: Tag; hue: number; count: number }>;
  onSelectAll: () => void;
  onSelectUnread: () => void;
  onSelectTag: (tagId: number) => void;
  onSelectFeed: (feedId: number) => void;
  onClose: () => void;
  onOpenManager: () => void;
  onOpenExplorer: () => void;
}

export function Sidebar(props: SidebarProps) {
  const isAllInbox = () =>
    props.filter === "all" && props.tagId === "all" && props.feedId === null;
  const isUnreadInbox = () => props.filter === "unread" && props.feedId === null;

  return (
    <aside class={styles.sidebar}>
      <div class={styles.header}>
        <span class={styles.title}>Library</span>
        <button class={styles.iconBtn} onClick={props.onClose} aria-label="Close sidebar">
          <Icon name="close" size={14} />
        </button>
      </div>

      <div class={styles.section}>
        <div class={styles.label}>Inbox</div>
        <button
          class={`${styles.item} ${isAllInbox() ? styles.itemActive : ""}`}
          onClick={props.onSelectAll}
        >
          <span>All posts</span>
          <span class={styles.count}>{props.totalCount}</span>
        </button>
        <button
          class={`${styles.item} ${isUnreadInbox() ? styles.itemActive : ""}`}
          onClick={props.onSelectUnread}
        >
          <span>Unread</span>
          <span class={`${styles.count} ${styles.countAccent}`}>{props.unreadCount}</span>
        </button>
      </div>

      <div class={styles.section}>
        <div class={styles.label}>Topics</div>
        <For each={props.tagsWithCounts}>
          {({ tag, hue, count }) => (
            <button
              class={`${styles.item} ${
                props.feedId === null && props.tagId === tag.id ? styles.itemActive : ""
              }`}
              onClick={() => props.onSelectTag(tag.id)}
            >
              <span class={styles.itemLeft}>
                <span
                  class={styles.tagDot}
                  style={{ background: `oklch(0.72 0.17 ${hue})` }}
                />
                {tag.name}
              </span>
              <span class={styles.count}>{count}</span>
            </button>
          )}
        </For>
        <Show when={props.tagsWithCounts.length === 0}>
          <div class={styles.empty}>No tags yet</div>
        </Show>
      </div>

      <div class={styles.section}>
        <div class={styles.label}>Feeds</div>
        <For each={[...feeds]}>
          {f => (
            <button
              class={`${styles.feedItem} ${
                props.feedId === f.id ? styles.itemActive : ""
              }`}
              onClick={() => props.onSelectFeed(f.id)}
            >
              <FeedAvatar feed={f} size={20} />
              <span class={styles.feedName}>{f.title}</span>
              <span class={styles.count}>{f.entries.length}</span>
            </button>
          )}
        </For>
      </div>

      <div class={styles.section}>
        <div class={styles.label}>Manage</div>
        <button class={styles.item} onClick={props.onOpenManager}>
          <span>Feeds & tags</span>
        </button>
        <button class={styles.item} onClick={props.onOpenExplorer}>
          <span>DB Explorer</span>
        </button>
      </div>
    </aside>
  );
}
