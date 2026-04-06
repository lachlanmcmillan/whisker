import { createSignal, type JSX } from "solid-js";
import { Button } from "./Button";
import styles from "./popover.module.css";

interface PopoverProps {
  trigger: JSX.Element;
  children: (close: () => void) => JSX.Element;
}

export function Popover(props: PopoverProps) {
  const [open, setOpen] = createSignal(false);
  const close = () => setOpen(false);

  return (
    <div class={styles.wrapper}>
      <Button onClick={() => setOpen(!open())}>{props.trigger}</Button>
      {open() && (
        <>
          <div class={styles.backdrop} onClick={close} />
          <div class={styles.panel}>{props.children(close)}</div>
        </>
      )}
    </div>
  );
}
