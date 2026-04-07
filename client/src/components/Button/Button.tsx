import type { JSX } from "solid-js";
import { splitProps } from "solid-js";
import styles from "./button.module.css";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "default" | "ghost";
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, [
    "active",
    "variant",
    "class",
    "children",
  ]);

  const classes = () =>
    [
      (local.variant ?? "default") === "ghost" ? styles.ghost : styles.button,
      local.active ? styles.active : "",
      local.class ?? "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <button class={classes()} {...rest}>
      {local.children}
    </button>
  );
}
