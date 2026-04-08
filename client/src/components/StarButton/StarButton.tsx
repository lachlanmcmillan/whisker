import styles from "./starButton.module.css";

interface StarButtonProps {
  starred: boolean;
  onClick: () => void;
}

export function StarButton(props: StarButtonProps) {
  return (
    <button
      class={`${styles.starButton} ${props.starred ? styles.starred : ""}`}
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        props.onClick();
      }}
      title={props.starred ? "Unstar" : "Star"}
    >
      {props.starred ? "\u2605" : "\u2606"}
    </button>
  );
}
