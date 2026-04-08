import { ActionButton } from "$components/ActionButton/ActionButton";

interface ArchiveButtonProps {
  archived: boolean;
  onClick: () => void;
}

export function ArchiveButton(props: ArchiveButtonProps) {
  return (
    <ActionButton
      active={props.archived}
      onClick={props.onClick}
      title={props.archived ? "Unarchive" : "Archive"}
      color="#f90"
      right="2.75rem"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="2" y="3" width="20" height="5" rx="1" />
        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
        <path d="M10 12h4" />
      </svg>
    </ActionButton>
  );
}
