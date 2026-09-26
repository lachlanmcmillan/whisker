import { Show, createSignal } from "solid-js";
import type { Feed, FeedEntry } from "$lib/api";
import { FeedAvatar, titleHue } from "$components/FeedAvatar/FeedAvatar";
import { CachedThumbnail } from "$components/CachedThumbnail/CachedThumbnail";
import { Icon, entryTypeFromUrl } from "$components/Icon/Icon";
import { shortTimeAgo, timeAgo } from "$lib/timeAgo";
import { CheckButton } from "$components/CheckButton/CheckButton";
import { ArchiveButton } from "$components/ArchiveButton/ArchiveButton";
import { toggleEntryRead, toggleEntryArchived } from "$stores/feeds.store";
import styles from "./entryCard.module.css";

interface EntryCardProps {
  entry: FeedEntry;
  feed: Pick<Feed, "id" | "title" | "image">;
  onSelectFeed: (feedId: number) => void;
}

export function EntryCard(props: EntryCardProps) {
  const isRead = () => !!props.entry.openedAt;
  const handleOpen = () => {
    if (!props.entry.feedId) return;
    toggleEntryRead(props.entry.feedId, props.entry.entryId, false);
  };
  const thumb = () => props.entry.thumbnail ?? props.feed.image ?? null;
  const [expanded, setExpanded] = createSignal(false);
  let card!: HTMLElement;

  const toggleExpanded = () => {
    setExpanded(v => !v);
    // Expanding moves the card onto its own row, so keep it on screen.
    requestAnimationFrame(() => card.scrollIntoView({ block: "nearest" }));
  };

  return (
    <article
      ref={card}
      class={styles.card}
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
      <Show when={expanded()}>
        <button
          type="button"
          class={styles.close}
          title="Close"
          aria-label="Close"
          onClick={toggleExpanded}
        >
          <Icon name="close" size={16} />
        </button>
      </Show>
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
      </a>
      <div class={styles.body}>
        <button
          type="button"
          class={styles.feedLink}
          title={`Show only ${props.feed.title}`}
          onClick={() => props.onSelectFeed(props.feed.id)}
        >
          <FeedAvatar feed={props.feed} size={30} />
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
        </div>
      </div>
      <Show when={props.entry.description}>
        <p class={styles.blurb} onClick={toggleExpanded}>
          {props.entry.description}
        </p>
      </Show>
    </article>
  );
}
