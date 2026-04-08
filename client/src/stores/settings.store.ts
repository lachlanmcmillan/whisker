import { createEffect } from "solid-js";
import { createStore } from "solid-js/store";

interface AppSettings {
  layout: "List" | "Grid";
  showUnreadOnly: boolean;
}

const defaultSettings: AppSettings = {
  layout: "List",
  showUnreadOnly: false,
};

export const appSettingsStore = createStore<AppSettings>(
  loadFromLocalStorage() ?? defaultSettings
);

createEffect(() => {
  saveToLocalStorage(appSettingsStore[0]);
});

function saveToLocalStorage(settings: AppSettings) {
  localStorage.setItem("appSettings", JSON.stringify(settings));
}

function loadFromLocalStorage(): AppSettings | undefined {
  const settings = localStorage.getItem("appSettings");
  if (settings) {
    return JSON.parse(settings) as AppSettings;
  }
}
