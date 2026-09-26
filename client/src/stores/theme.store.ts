import { createSignal } from "solid-js";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "whisker-mode";

function loadMode(): ThemeMode {
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

function applyMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
}

const [themeMode, setThemeMode] = createSignal<ThemeMode>(loadMode());
applyMode(themeMode());

export { themeMode };

export function toggleThemeMode() {
  const next: ThemeMode = themeMode() === "dark" ? "light" : "dark";
  localStorage.setItem(STORAGE_KEY, next);
  applyMode(next);
  setThemeMode(next);
}
