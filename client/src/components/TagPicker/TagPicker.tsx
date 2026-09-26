import { createMemo, createSignal, For, Show, type JSX } from "solid-js";
import { tags } from "$stores/feeds.store";
import { tagColor } from "$lib/tagHue";
import styles from "./tagPicker.module.css";

interface TagPickerProps {
  trigger: JSX.Element;
  triggerClass?: string;
  triggerLabel?: string;
  exclude?: number[];
  onPick: (name: string) => void;
}

export function TagPicker(props: TagPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [highlight, setHighlight] = createSignal(0);

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
  };

  // Close straight away; the caller applies the change and reports errors.
  const pick = (name: string) => {
    close();
    props.onPick(name);
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
      if (option) pick(option.name);
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
            onInput={e => {
              setQuery(e.currentTarget.value);
              setHighlight(0);
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
                      onClick={() => pick(option.name)}
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
        </div>
      </Show>
    </div>
  );
}
