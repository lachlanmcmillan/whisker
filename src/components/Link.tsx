import type { AnchorHTMLAttributes } from "react";
import styles from "./link.module.css";

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {}

export function Link({ className, ...props }: LinkProps) {
  const classes = [styles.link, className ?? ""].filter(Boolean).join(" ");
  return <a className={classes} target="_blank" rel="noopener noreferrer" {...props} />;
}
