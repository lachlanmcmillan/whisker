import styles from "./checkButton.module.css";

interface CheckButtonProps {
  checked: boolean;
  onClick: () => void;
}

export function CheckButton(props: CheckButtonProps) {
  return (
    <button
      class={`${styles.checkButton} ${props.checked ? styles.checked : ""}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onClick();
      }}
      title={props.checked ? "Mark as unread" : "Mark as read"}
    >
      {"\u2713"}
    </button>
  );
}
