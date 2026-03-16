import { createSignal, Show } from "solid-js";
import { Popover } from "./Popover";
import { Button } from "./Button";
import { addNewFeed } from "../lib/feed/addNewFeed";
import styles from "./addFeedPopover.module.css";

interface AddFeedPopoverProps {
  onAdded: () => void;
}

export function AddFeedPopover(props: AddFeedPopoverProps) {
  const [url, setUrl] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  return (
    <Popover trigger="+ Add Feed">
      {(close) => {
        const handleSubmit = async (e: Event) => {
          e.preventDefault();
          const value = url().trim();
          if (!value) return;

          setError(null);
          setSubmitting(true);

          const result = await addNewFeed(value);

          setSubmitting(false);

          if (result.error) {
            setError(result.error.message);
            return;
          }

          setUrl("");
          setError(null);
          close();
          props.onAdded();
        };

        return (
          <form onSubmit={handleSubmit}>
            <input
              class={styles.input}
              type="url"
              placeholder="https://example.com/feed.xml"
              value={url()}
              onInput={(e) => {
                setUrl(e.currentTarget.value);
                setError(null);
              }}
              disabled={submitting()}
              autofocus
            />
            <Show when={error()}>
              {(msg) => <p class={styles.error}>{msg()}</p>}
            </Show>
            <div class={styles.actions}>
              <Button type="submit" disabled={submitting()}>
                {submitting() ? "Adding..." : "Add"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                disabled={submitting()}
              >
                Cancel
              </Button>
            </div>
          </form>
        );
      }}
    </Popover>
  );
}
