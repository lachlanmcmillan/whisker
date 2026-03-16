import { render } from "solid-js/web";
import "./index.css";
import App from "./App.tsx";
import { initDB } from "./lib/sqlite/sqlite";

initDB().then(() => {
  render(() => <App />, document.getElementById("root")!);
});
