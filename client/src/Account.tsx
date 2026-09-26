import { createSignal, For, Show, onMount } from "solid-js";
import {
  acceptAccountToken,
  changePassword,
  disableUser,
  inspectAccountToken,
  inviteUser,
  listUsers,
  logout,
  resetUser,
  type User,
} from "$lib/api";
import styles from "$components/LoginForm/LoginForm.module.css";

export function Account(props: { user: User; onLogout: () => void }) {
  const [users, setUsers] = createSignal<User[]>([]);
  const [email, setEmail] = createSignal("");
  const [currentPassword, setCurrentPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [link, setLink] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const reload = async () => {
    if (props.user.role === "owner") setUsers(await listUsers());
  };
  onMount(() => {
    void reload();
  });
  const run = async (action: () => Promise<unknown>) => {
    setMessage("");
    setBusy(true);
    try {
      await action();
      await reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class={styles.container}>
      <div class={styles.form}>
        <h2>Account</h2>
        <p>{props.user.email}</p>
        <button
          onClick={() =>
            void run(async () => {
              await logout();
              props.onLogout();
            })
          }
        >
          Sign out
        </button>
        <h3>Change password</h3>
        <input
          type="password"
          autocomplete="current-password"
          placeholder="Current password"
          value={currentPassword()}
          onInput={e => setCurrentPassword(e.currentTarget.value)}
        />
        <input
          type="password"
          autocomplete="new-password"
          placeholder="New password (12+ characters)"
          value={newPassword()}
          onInput={e => setNewPassword(e.currentTarget.value)}
        />
        <button
          disabled={busy()}
          onClick={() =>
            void run(async () => {
              await changePassword(currentPassword(), newPassword());
              setCurrentPassword("");
              setNewPassword("");
              setMessage("Password changed");
            })
          }
        >
          Save password
        </button>
        <Show when={props.user.role === "owner"}>
          <h3>Users</h3>
          <input
            type="email"
            placeholder="Invite email"
            value={email()}
            onInput={e => setEmail(e.currentTarget.value)}
          />
          <button
            disabled={busy()}
            onClick={() =>
              void run(async () => {
                const result = await inviteUser(email());
                setLink(result.inviteUrl);
                setEmail("");
              })
            }
          >
            Create invitation
          </button>
          <For each={users()}>
            {user => (
              <div>
                <span>
                  {user.email} ({user.role}) {user.disabledAt ? "Disabled" : ""}
                </span>
                <Show when={user.role === "member" && !user.disabledAt}>
                  <button
                    disabled={busy()}
                    onClick={() =>
                      void run(async () =>
                        setLink((await resetUser(user.id)).resetUrl)
                      )
                    }
                  >
                    Reset link
                  </button>
                  <button
                    disabled={busy()}
                    onClick={() =>
                      void run(async () => {
                        await disableUser(user.id);
                      })
                    }
                  >
                    Disable
                  </button>
                </Show>
              </div>
            )}
          </For>
          <Show when={link()}>
            <div>
              <p>Share this one-time link privately:</p>
              <input
                readOnly
                value={link()}
                onFocus={e => e.currentTarget.select()}
              />
              <button
                onClick={() => void navigator.clipboard.writeText(link())}
              >
                Copy link
              </button>
            </div>
          </Show>
        </Show>
        <Show when={message()}>
          <p class={styles.error}>{message()}</p>
        </Show>
      </div>
    </div>
  );
}

export function AcceptAccount(props: {
  token: string;
  onAccepted: (user: User) => void;
}) {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  onMount(async () => {
    try {
      setEmail((await inspectAccountToken(props.token)).email);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  });
  return (
    <div class={styles.container}>
      <form
        class={styles.form}
        onSubmit={async e => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            const user = await acceptAccountToken(props.token, password());
            history.replaceState(null, "", "/");
            props.onAccepted(user);
          } catch (cause) {
            setMessage(cause instanceof Error ? cause.message : String(cause));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>Set your Whisker password</h1>
        <p>{email()}</p>
        <input
          type="password"
          autocomplete="new-password"
          placeholder="Password (12+ characters)"
          value={password()}
          onInput={e => setPassword(e.currentTarget.value)}
          required
          minlength={12}
        />
        <button type="submit" disabled={busy()}>
          {busy() ? "Saving…" : "Set password"}
        </button>
        <Show when={message()}>
          <p class={styles.error}>{message()}</p>
        </Show>
      </form>
    </div>
  );
}
