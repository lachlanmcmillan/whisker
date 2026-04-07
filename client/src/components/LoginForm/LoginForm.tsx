import { createSignal } from "solid-js";
import { setApiKey } from "$lib/api";
import styles from "./LoginForm.module.css";

interface LoginFormProps {
  onLogin: () => void;
}

export function LoginForm(props: LoginFormProps) {
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!password()) return;
    setApiKey(password());
    setError(null);
    props.onLogin();
  };

  return (
    <div class={styles.container}>
      <form class={styles.form} onSubmit={handleSubmit}>
        <h1>Whisker</h1>
        <input
          type="text"
          name="username"
          autocomplete="username"
          placeholder="Username"
          tabindex={-1}
          class={styles.username}
        />
        <input
          type="password"
          name="password"
          autocomplete="current-password"
          placeholder="Password"
          value={password()}
          onInput={e => setPassword(e.currentTarget.value)}
        />
        <button type="submit">Log in</button>
        {error() && <p class={styles.error}>{error()}</p>}
      </form>
    </div>
  );
}
