import { createSignal, Show } from "solid-js";
import DOMPurify from "dompurify";
import type { FeedEntry } from "../models/feed.model";
import { markEntryOpened, clearEntryOpened } from "../models/feed.model";
import { Button } from "./Button";
import { CachedThumbnail } from "./CachedThumbnail";
import { CheckButton } from "./CheckButton";
import { Link } from "./Link";
import { Title } from "./Title";
import styles from "./entryItem.module.css";

export function EntryItem(props: { entry: FeedEntry; onToggleRead?: () => void }) {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <li class={styles.entry}>
      <CheckButton
        checked={!!props.entry.openedAt}
        onClick={async () => {
          if (!props.entry.feedId) return;
          if (props.entry.openedAt) {
            await clearEntryOpened(props.entry.feedId, props.entry.entryId);
          } else {
            await markEntryOpened(props.entry.feedId, props.entry.entryId);
          }
          props.onToggleRead?.();
        }}
      />
      <Show when={props.entry.thumbnail}>
        <Link
          href={props.entry.link}
          onClick={() => props.entry.feedId && markEntryOpened(props.entry.feedId, props.entry.entryId)}
        >
          <CachedThumbnail
            url={props.entry.thumbnail!}
            width={120}
            alt={props.entry.title}
          />
        </Link>
      </Show>
      <div class={styles.entryBody}>
        <Title level={2}>
          <Link
            href={props.entry.link}
            onClick={() => props.entry.feedId && markEntryOpened(props.entry.feedId, props.entry.entryId)}
          >
            {props.entry.title}
          </Link>
        </Title>
        <p class={styles.meta}>
          by {props.entry.author} —{" "}
          {new Date(props.entry.published).toLocaleDateString()}
          <Show when={props.entry.updated}>
            {` — Updated: ${new Date(props.entry.updated!).toLocaleDateString()}`}
          </Show>
        </p>
        <Show when={props.entry.description}>
          <p class={styles.description}>{props.entry.description}</p>
        </Show>
        <Show when={props.entry.content}>
          <Button
            variant="ghost"
            onClick={() => setExpanded(!expanded())}
          >
            {expanded() ? "show less" : "show more..."}
          </Button>
          <Show when={expanded()}>
            <div
              class={styles.content}
              innerHTML={DOMPurify.sanitize(props.entry.content!)}
            />
          </Show>
        </Show>
      </div>
    </li>
  );
}
