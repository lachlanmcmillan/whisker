import { createSignal } from "solid-js";
import { Popover } from "./Popover";
import { Button } from "./Button";
import styles from "./addFeedPopover.module.css";

interface AddFeedPopoverProps {
  onAdd: (url: string) => void;
}

export function AddFeedPopover(props: AddFeedPopoverProps) {
  const [url, setUrl] = createSignal("");

  return (
    <Popover trigger="+ Add Feed">
      {(close) => {
        const handleSubmit = (e: Event) => {
          e.preventDefault();
          const value = url().trim();
          if (value) {
            props.onAdd(value);
            setUrl("");
            close();
          }
        };

        return (
          <form onSubmit={handleSubmit}>
            <input
              class={styles.input}
              type="url"
              placeholder="https://example.com/feed.xml"
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
              autofocus
            />
            <div class={styles.actions}>
              <Button type="submit">Add</Button>
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
            </div>
          </form>
        );
      }}
    </Popover>
  );
}
