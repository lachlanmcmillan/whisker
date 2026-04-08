import { ActionButton } from "$components/ActionButton/ActionButton";

interface CheckButtonProps {
  checked: boolean;
  onClick: () => void;
}

export function CheckButton(props: CheckButtonProps) {
  return (
    <ActionButton
      active={props.checked}
      onClick={props.onClick}
      title={props.checked ? "Mark as unread" : "Mark as read"}
      color="#6c6"
      right="0.5rem"
    >
      {"\u2713"}
    </ActionButton>
  );
}
