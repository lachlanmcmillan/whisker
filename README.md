# Whisker

A feed reader that runs in your browser.

## Why

You own it. There is no recommendation algorithm or third-party reader account. Accounts are invite only, and each person has a private library and reading state.

Whisker tracks YouTube channels and blogs so you know when there's new content, and keeps track of what you have and haven't seen/read.

## How it works

The frontend is a SolidJS app. A Bun server or Cloudflare Worker fetches RSS and Atom feeds and discovers feed URLs from web pages. On Cloudflare, D1 stores shared feed content alongside private subscriptions, tags, and reading state. The browser signs in with email and password and uses an HTTP-only session cookie.

## Current status

You can subscribe to feeds, browse entries in grid or list view, organize feeds with tags, mark entries read, archive or star entries, and refresh feeds. A background schedule refreshes feeds whose configured interval is due.

## Cloudflare Worker and D1

The Worker serves the built frontend and API from one origin. D1 stores accounts, shared feeds and entries, and private libraries. A cron trigger checks subscribed feeds due for refresh every five minutes. A new D1 database starts empty; the existing SQLite database is not imported automatically.

Current deployment: https://whisker.lachy-mcm-services.workers.dev

1. Authenticate Wrangler with `bunx wrangler login` or set `CLOUDFLARE_API_TOKEN`.
2. The `whisker` D1 database is bound in `wrangler.jsonc`. For a different Cloudflare account, create a database with `bunx wrangler d1 create whisker --location apac` and replace its database ID there.
3. Apply the schema with `bun run worker:d1:remote`.
4. Put a long random `API_KEY="your-key"` in the gitignored `.dev.vars` file. It is used once to create the first owner setup link.
5. Deploy with `bun run worker:deploy`. This uploads the secret with the Worker. Wrangler prints the `workers.dev` URL.
6. Call `POST /auth/bootstrap` with `Authorization: Bearer <API_KEY>` and JSON `{ "email": "owner@example.com" }`. Open the returned one-time setup URL and set the owner's password. Once the owner is active, bootstrap is disabled.

The owner can create one-time invitation and reset links on the Account screen and share them privately. Owner setup and invitations expire after seven days; reset links expire after one hour. There is no email delivery service yet.

New passwords use scrypt (`N=16384, r=8, p=5`) with a unique random salt. Existing PBKDF2-chain hashes are verified and upgraded to scrypt after a successful sign-in.

For local Worker development, put `API_KEY="your-key"` in `.dev.vars`, run `bun run worker:d1:local`, then `bun run worker:dev`.

The old Bun server deployment instructions are below for installations that still use it.

## Legacy Bun server deployment

### Prerequisites

- An EC2 instance (or any Ubuntu server) with SSH access
- A domain with an A record pointing to the server (e.g. `api.whisker.lmcmillan.dev`)
- Ports 22, 80, and 443 open in the server's security group
  - 80: required for Let's Encrypt certificate challenges
  - 443: serves HTTPS traffic
  - 22: SSH access

### Server setup

See [SETUP.md](SETUP.md) for instructions on installing Bun, PM2, and Caddy on the server.

### Deploy the server

SSHs into the server, pulls the latest code, installs deps, runs migrations, and restarts PM2. Runs a health check against `/monitor` to verify the deploy succeeded.

```sh
bun run deploy-server-ssh
```

### Deploy the client

The client is deployed to GitHub Pages via a GitHub Actions workflow on push to `main`. Set `VITE_API_URL` in the repo's GitHub Actions variables to point to the server (e.g. `https://api.whisker.lmcmillan.dev`).

### Environment variables

Set these in `.env.local` at the repo root (local machine, for deploy script):

| Variable             | Description                                | Example          |
| -------------------- | ------------------------------------------ | ---------------- |
| `DEPLOY_SSH_HOST`    | SSH destination for the server             | `ubuntu@1.2.3.4` |
| `DEPLOY_SERVER_PORT` | Port the server listens on (default: 3000) | `3000`           |
| `DEPLOY_REMOTE_DIR`  | Path to the repo on the server             | `~/whisker`      |

Set these in `.env.local` on the remote server:

| Variable             | Description                                                         | Example                         |
| -------------------- | ------------------------------------------------------------------- | ------------------------------- |
| `API_KEY`            | API key for authenticating requests. Alphanumeric only (no symbols) | `abc123...`                     |
| `DEPLOY_CORS_ORIGIN` | Allowed CORS origin for the frontend                                | `https://whisker.lmcmillan.dev` |
