import { createSignal } from "solid-js";
import { login } from "$lib/api";
import styles from "./LoginForm.module.css";

interface LoginFormProps {
  onLogin: () => void;
}

export function LoginForm(props: LoginFormProps) {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email(), password());
      props.onLogin();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class={styles.container}>
      <form class={styles.form} onSubmit={handleSubmit}>
        <h1>Whisker</h1>
        <input
          type="email"
          name="username"
          autocomplete="username"
          placeholder="Email"
          value={email()}
          onInput={e => setEmail(e.currentTarget.value)}
          required
        />
        <input
          type="password"
          name="password"
          autocomplete="current-password"
          placeholder="Password"
          value={password()}
          onInput={e => setPassword(e.currentTarget.value)}
        />
        <button type="submit" disabled={submitting()}>
          {submitting() ? "Signing in…" : "Log in"}
        </button>
        {error() && <p class={styles.error}>{error()}</p>}
      </form>
    </div>
  );
}
