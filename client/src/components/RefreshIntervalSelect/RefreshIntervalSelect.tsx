import { For, Show } from "solid-js";
import styles from "./refreshIntervalSelect.module.css";

export const PRESETS = [60, 360, 1440, 4320];

interface RefreshIntervalSelectProps {
  value: number | null;
  onChange: (mins: number | null) => void;
  disabled?: boolean;
  class?: string;
}

export function RefreshIntervalSelect(props: RefreshIntervalSelectProps) {
  const isCustom = () => props.value !== null && !PRESETS.includes(props.value);

  return (
    <select
      class={`${styles.select} ${props.class ?? ""}`}
      value={props.value?.toString() ?? ""}
      disabled={props.disabled}
      onChange={e => {
        const v = e.currentTarget.value;
        props.onChange(v === "" ? null : Number(v));
      }}
    >
      <option value="">Off</option>
      <For each={PRESETS}>
        {mins => <option value={mins}>{formatInterval(mins)}</option>}
      </For>
      <Show when={isCustom()}>
        <option value={props.value!}>{formatInterval(props.value!)}</option>
      </Show>
    </select>
  );
}

export function formatInterval(mins: number): string {
  if (mins % 1440 === 0) {
    const days = mins / 1440;
    return `Every ${days === 1 ? "day" : `${days} days`}`;
  }
  if (mins % 60 === 0) {
    const hours = mins / 60;
    return `Every ${hours === 1 ? "hour" : `${hours} hours`}`;
  }
  return `Every ${mins} min`;
}
