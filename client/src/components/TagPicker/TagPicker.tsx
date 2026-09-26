import { createMemo, createSignal, For, Show, type JSX } from "solid-js";
import { tags } from "$stores/feeds.store";
import { tagColor } from "$lib/tagHue";
import styles from "./tagPicker.module.css";

interface TagPickerProps {
  trigger: JSX.Element;
  triggerClass?: string;
  triggerLabel?: string;
  exclude?: number[];
  onPick: (name: string) => Promise<void>;
}

export function TagPicker(props: TagPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [highlight, setHighlight] = createSignal(0);
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const normalized = () => query().trim().toLowerCase();

  const options = createMemo(() => {
    const q = normalized();
    const exclude = new Set(props.exclude ?? []);
    const matches = tags
      .filter(t => !exclude.has(t.id) && t.name.includes(q))
      .map(t => ({ name: t.name, isNew: false }));
    if (q && !tags.some(t => t.name === q)) {
      matches.push({ name: q, isNew: true });
    }
    return matches;
  });

  const close = () => {
    setOpen(false);
    setQuery("");
    setHighlight(0);
    setError(null);
  };

  const pick = async (name: string) => {
    if (submitting()) return;
    setSubmitting(true);
    setError(null);
    try {
      await props.onPick(name);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const count = options().length;
    if (e.key === "ArrowDown" && count) {
      e.preventDefault();
      setHighlight(i => (i + 1) % count);
    } else if (e.key === "ArrowUp" && count) {
      e.preventDefault();
      setHighlight(i => (i - 1 + count) % count);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options()[highlight()];
      if (option) void pick(option.name);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div class={styles.wrapper}>
      <button
        type="button"
        class={props.triggerClass ?? styles.trigger}
        aria-label={props.triggerLabel}
        title={props.triggerLabel}
        onClick={() => (open() ? close() : setOpen(true))}
      >
        {props.trigger}
      </button>
      <Show when={open()}>
        <div class={styles.backdrop} onClick={close} />
        <div class={styles.panel}>
          <input
            class={styles.input}
            type="text"
            placeholder="Find or create tag…"
            value={query()}
            disabled={submitting()}
            onInput={e => {
              setQuery(e.currentTarget.value);
              setHighlight(0);
              setError(null);
            }}
            onKeyDown={onKeyDown}
            ref={el => queueMicrotask(() => el.focus())}
          />
          <Show
            when={options().length > 0}
            fallback={<p class={styles.hint}>Type to create a tag</p>}
          >
            <ul class={styles.options}>
              <For each={options()}>
                {(option, i) => (
                  <li>
                    <button
                      type="button"
                      class={`${styles.option} ${
                        i() === highlight() ? styles.optionActive : ""
                      }`}
                      onMouseEnter={() => setHighlight(i())}
                      onClick={() => void pick(option.name)}
                      disabled={submitting()}
                    >
                      <Show
                        when={!option.isNew}
                        fallback={
                          <span class={styles.createLabel}>Create</span>
                        }
                      >
                        <span
                          class={styles.dot}
                          style={{ background: tagColor(option.name) }}
                        />
                      </Show>
                      {option.name}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <Show when={error()}>
            {msg => <p class={styles.error}>{msg()}</p>}
          </Show>
        </div>
      </Show>
    </div>
  );
}
