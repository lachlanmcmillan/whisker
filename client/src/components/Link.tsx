import type { JSX } from "solid-js";
import { splitProps } from "solid-js";
import styles from "./link.module.css";

type LinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement>;

export function Link(props: LinkProps) {
  const [local, rest] = splitProps(props, ["class", "children"]);

  const classes = () =>
    [styles.link, local.class ?? ""].filter(Boolean).join(" ");

  return (
    <a class={classes()} target="_blank" rel="noopener noreferrer" {...rest}>
      {local.children}
    </a>
  );
}
