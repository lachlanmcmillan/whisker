import type { ButtonHTMLAttributes } from "react";
import styles from "./button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "default" | "ghost";
}

export function Button({
  active,
  variant = "default",
  className,
  ...props
}: ButtonProps) {
  const classes = [
    variant === "ghost" ? styles.ghost : styles.button,
    active ? styles.active : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} {...props} />;
}
