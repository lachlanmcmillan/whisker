import { ActionButton } from "$components/ActionButton/ActionButton";

interface StarButtonProps {
  starred: boolean;
  onClick: () => void;
}

export function StarButton(props: StarButtonProps) {
  return (
    <ActionButton
      active={props.starred}
      onClick={props.onClick}
      title={props.starred ? "Unstar" : "Star"}
      color="#fd0"
      right="5rem"
    >
      {props.starred ? "\u2605" : "\u2606"}
    </ActionButton>
  );
}
