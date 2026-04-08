import type { JSX } from "solid-js";
import styles from "./actionButton.module.css";

interface ActionButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  color: string;
  right: string;
  children: JSX.Element;
}

export function ActionButton(props: ActionButtonProps) {
  return (
    <button
      class={`${styles.actionButton} ${props.active ? styles.active : ""}`}
      style={{ right: props.right, "--action-color": props.color }}
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        props.onClick();
      }}
      title={props.title}
    >
      {props.children}
    </button>
  );
}
