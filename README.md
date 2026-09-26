# Whisker

A personal feed reader that runs in your browser.

## Why

You own it. There is no recommendation algorithm or third-party reader account. An API key protects your personal feed data.

Whisker tracks YouTube channels and blogs so you know when there's new content, and keeps track of what you have and haven't seen/read.

## How it works

The frontend is a SolidJS app. A Bun server or Cloudflare Worker fetches RSS and Atom feeds, discovers feed URLs from web pages, and stores subscriptions and reading state in SQLite or Cloudflare D1. The client talks to that API using an API key.

## Current status

You can subscribe to feeds, browse entries in grid or list view, organize feeds with tags, mark entries read, archive or star entries, and refresh feeds. A background schedule refreshes feeds whose configured interval is due.

## Cloudflare Worker and D1

The Worker serves the built frontend and API from one origin. D1 stores feeds, entries, tags, and reading state. A cron trigger checks for feeds due for refresh every five minutes. A new D1 database starts empty; the existing SQLite database is not imported automatically.

Current deployment: https://whisker.lachy-mcm-services.workers.dev

1. Authenticate Wrangler with `bunx wrangler login` or set `CLOUDFLARE_API_TOKEN`.
2. The `whisker` D1 database is bound in `wrangler.jsonc`. For a different Cloudflare account, create a database with `bunx wrangler d1 create whisker --location apac` and replace its database ID there.
3. Apply the schema with `bun run worker:d1:remote`.
4. Put `API_KEY="your-key"` in the gitignored `.dev.vars` file. Use a long, random value and enter the same key in Whisker's login form.
5. Deploy with `bun run worker:deploy`. This uploads the secret with the Worker. Wrangler prints the `workers.dev` URL.

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
