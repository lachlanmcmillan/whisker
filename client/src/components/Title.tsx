import type { JSX } from "solid-js";
import { splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import styles from "./title.module.css";

interface TitleProps extends JSX.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2;
}

export function Title(props: TitleProps) {
  const [local, rest] = splitProps(props, ["level", "class", "children"]);

  const tag = () => ((local.level ?? 1) === 1 ? "h1" : "h2");
  const classes = () =>
    [(local.level ?? 1) === 1 ? styles.h1 : styles.h2, local.class ?? ""]
      .filter(Boolean)
      .join(" ");

  return (
    <Dynamic component={tag()} class={classes()} {...rest}>
      {local.children}
    </Dynamic>
  );
}
