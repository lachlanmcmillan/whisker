import type { HTMLAttributes } from "react";
import styles from "./title.module.css";

interface TitleProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2;
}

export function Title({ level = 1, className, ...props }: TitleProps) {
  const Tag = level === 1 ? "h1" : "h2";
  const classes = [level === 1 ? styles.h1 : styles.h2, className ?? ""]
    .filter(Boolean)
    .join(" ");

  return <Tag className={classes} {...props} />;
}
