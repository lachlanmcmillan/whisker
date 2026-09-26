import { Show, createSignal } from "solid-js";
import type { Feed, FeedEntry } from "$lib/api";
import { FeedAvatar, titleHue } from "$components/FeedAvatar/FeedAvatar";
import { CachedThumbnail } from "$components/CachedThumbnail/CachedThumbnail";
import { Icon, entryTypeFromUrl } from "$components/Icon/Icon";
import { shortTimeAgo, timeAgo } from "$lib/timeAgo";
import { formatDuration } from "$lib/duration";
import { CheckButton } from "$components/CheckButton/CheckButton";
import { ArchiveButton } from "$components/ArchiveButton/ArchiveButton";
import { toggleEntryRead, toggleEntryArchived } from "$stores/feeds.store";
import styles from "./entryListRow.module.css";

interface EntryListRowProps {
  entry: FeedEntry;
  feed: Pick<Feed, "id" | "title" | "image">;
  onSelectFeed: (feedId: number) => void;
}

export function EntryListRow(props: EntryListRowProps) {
  const isRead = () => !!props.entry.openedAt;
  const handleOpen = () => {
    if (!props.entry.feedId) return;
    toggleEntryRead(props.entry.feedId, props.entry.entryId, false);
  };
  const thumb = () => props.entry.thumbnail ?? props.feed.image ?? null;
  const [expanded, setExpanded] = createSignal(false);

  return (
    <article
      class={styles.row}
      data-read={isRead() ? "true" : "false"}
      data-expanded={expanded() ? "true" : "false"}
    >
      <CheckButton
        checked={isRead()}
        onClick={() => {
          if (!props.entry.feedId) return;
          toggleEntryRead(props.entry.feedId, props.entry.entryId, isRead());
        }}
      />
      <ArchiveButton
        archived={!!props.entry.archivedAt}
        onClick={() => {
          if (!props.entry.feedId) return;
          toggleEntryArchived(
            props.entry.feedId,
            props.entry.entryId,
            !!props.entry.archivedAt
          );
        }}
      />
      <a
        class={styles.thumbLink}
        href={props.entry.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleOpen}
      >
        <Show
          when={thumb()}
          fallback={
            <div
              class={styles.thumbPlaceholder}
              style={{ "--thumb-hue": titleHue(props.feed.title) }}
            />
          }
        >
          {url => (
            <CachedThumbnail
              url={url()}
              alt={props.entry.title}
              class={styles.thumb}
            />
          )}
        </Show>
        <Show when={props.entry.durationSeconds}>
          {seconds => (
            <span class={styles.duration}>{formatDuration(seconds())}</span>
          )}
        </Show>
      </a>
      <button
        type="button"
        class={styles.feedLink}
        title={`Show only ${props.feed.title}`}
        onClick={() => props.onSelectFeed(props.feed.id)}
      >
        <FeedAvatar feed={props.feed} size={28} />
      </button>
      <div class={styles.text}>
        <h3 class={styles.title}>
          <a
            href={props.entry.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOpen}
          >
            {props.entry.title}
          </a>
        </h3>
        <div class={styles.meta}>
          <Icon
            name={entryTypeFromUrl(props.entry.link)}
            size={12}
            color="var(--accent)"
          />
          <span>
            <button
              type="button"
              class={`${styles.feedLink} ${styles.feedName}`}
              onClick={() => props.onSelectFeed(props.feed.id)}
            >
              {props.feed.title}
            </button>{" "}
            ·{" "}
            <span title={timeAgo(props.entry.published)}>
              {shortTimeAgo(props.entry.published)}
            </span>
          </span>
        </div>
        <Show when={props.entry.description}>
          <p class={styles.blurb} onClick={() => setExpanded(v => !v)}>
            {props.entry.description}
          </p>
        </Show>
      </div>
    </article>
  );
}
