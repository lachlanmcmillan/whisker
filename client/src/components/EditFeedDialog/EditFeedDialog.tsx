import { createSignal, Show } from "solid-js";
import { Button } from "$components/Button/Button";
import { editFeed } from "$stores/feeds.store";
import type { Feed } from "$lib/api";
import styles from "./editFeedDialog.module.css";

interface EditFeedDialogProps {
  feed: Feed;
  onClose: () => void;
}

export function EditFeedDialog(props: EditFeedDialogProps) {
  const [title, setTitle] = createSignal(props.feed.title);
  const [author, setAuthor] = createSignal(props.feed.author);
  const [description, setDescription] = createSignal(props.feed.description);
  const [image, setImage] = createSignal(props.feed.image ?? "");
  const [link, setLink] = createSignal(props.feed.link);
  const [feedUrl, setFeedUrl] = createSignal(props.feed.feedUrl);
  const [refreshIntervalMins, setRefreshIntervalMins] = createSignal(
    props.feed.refreshIntervalMins?.toString() ?? ""
  );
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const refreshIntervalValue = refreshIntervalMins().trim();
    let parsedRefreshIntervalMins: number | null = null;
    if (refreshIntervalValue !== "") {
      const parsed = Number(refreshIntervalValue);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setError("Auto refresh must be a whole number greater than 0");
        setSubmitting(false);
        return;
      }
      parsedRefreshIntervalMins = parsed;
    }

    try {
      await editFeed(props.feed.id, {
        title: title(),
        author: author(),
        description: description(),
        image: image() || undefined,
        link: link(),
        feedUrl: feedUrl(),
        refreshIntervalMins: parsedRefreshIntervalMins,
      });
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return (
    <>
      <div class={styles.backdrop} onClick={props.onClose} />
      <div class={styles.dialog}>
        <h3 class={styles.title}>Edit Feed</h3>
        <form onSubmit={handleSubmit}>
          <div class={styles.field}>
            <label>Title</label>
            <input
              value={title()}
              onInput={e => setTitle(e.currentTarget.value)}
              disabled={submitting()}
              autofocus
            />
          </div>
          <div class={styles.field}>
            <label>Author</label>
            <input
              value={author()}
              onInput={e => setAuthor(e.currentTarget.value)}
              disabled={submitting()}
            />
          </div>
          <div class={styles.field}>
            <label>Description</label>
            <input
              value={description()}
              onInput={e => setDescription(e.currentTarget.value)}
              disabled={submitting()}
            />
          </div>
          <div class={styles.field}>
            <label>Image URL</label>
            <input
              value={image()}
              onInput={e => setImage(e.currentTarget.value)}
              disabled={submitting()}
              placeholder="https://..."
            />
          </div>
          <div class={styles.field}>
            <label>Website URL</label>
            <input
              value={link()}
              onInput={e => setLink(e.currentTarget.value)}
              disabled={submitting()}
            />
          </div>
          <div class={styles.field}>
            <label>Feed URL</label>
            <input
              value={feedUrl()}
              onInput={e => setFeedUrl(e.currentTarget.value)}
              disabled={submitting()}
            />
          </div>
          <div class={styles.field}>
            <label>Auto refresh (minutes)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={refreshIntervalMins()}
              onInput={e => setRefreshIntervalMins(e.currentTarget.value)}
              disabled={submitting()}
            />
            <p class={styles.help}>Leave blank to disable automatic refresh.</p>
          </div>
          <Show when={error()}>
            {msg => <p class={styles.error}>{msg()}</p>}
          </Show>
          <div class={styles.actions}>
            <Button type="submit" disabled={submitting()}>
              {submitting() ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={props.onClose}
              disabled={submitting()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
