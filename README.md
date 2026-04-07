# Whisker

A personal feed reader that runs in your browser.

## Why

You own it. No proprietary service collecting data on you. No risk of it getting shut down. No login, no account, no algorithm deciding what you see.

Whisker tracks YouTube channels and blogs so you know when there's new content, and keeps track of what you have and haven't seen/read.

## How it works

Feed fetching happens in the browser, not on a server. This means no central server IP to get rate-limited or blocked by services. If this reader is shared with friends, the fetching load is distributed across their browsers.

The database is SQLite WASM running in the browser via OPFS. RSS and Atom feeds are supported with auto-discovery from website URLs.

## Current status

Working single-browser prototype. You can subscribe to feeds, browse entries in grid or list view, toggle read state, and refresh feeds. It's daily-driver ready on one device.

## The sync problem

The architecture is local-first: SQLite lives in the browser via OPFS, which is per-origin and per-browser. There is no path from one browser to another without introducing some form of sync.

### What we know

- Sync is the only blocker to daily use across devices
- Feed fetching must stay client-side to distribute IP load (this is a feature, not a limitation)
- A sync mechanism should be simple. For one user across a few devices, latest-write-wins at the row level is sufficient. No CRDTs or complex merge logic needed
- Each row has a timestamp; when two copies disagree, the newer write wins
- This works because feed reader data (subscriptions, read state, entries) doesn't have meaningful merge conflicts

### What syncs

- Feed subscriptions (add/remove)
- Read/unread state (the primary thing that needs to travel between devices)
- Entry metadata (though entries mostly come from the feed itself)

### What doesn't need to sync

- Cached thumbnails (each device can fetch its own)
- Full article content (fetched fresh from the feed)

### Open question

How the sync data travels between devices. The "relay" could be anything that can store and retrieve a blob: a cloud folder (iCloud Drive, Dropbox), a GitHub repo/gist, an S3 bucket, a tiny API on a free tier, or something else entirely. The transport is an open design decision.

## Deploy

### Prerequisites

- An EC2 instance (or any Ubuntu server) with SSH access
- A domain with an A record pointing to the server (e.g. `api.whisker.lmcmillan.dev`)
- Ports 22, 80, and 443 open in the server's security group
  - 80: required for Let's Encrypt certificate challenges
  - 443: serves HTTPS traffic
  - 22: SSH access

### Server setup

See [SETUP.md](SETUP.md) for instructions on installing Docker and Caddy on the server.

### Deploy the server

Builds a Docker image locally, uploads it to the server via scp, and starts the container. Runs a health check against `/monitor` to verify the deploy succeeded.

```sh
bun run deploy-server-ssh
```

### Deploy the client

The client is deployed to GitHub Pages via a GitHub Actions workflow on push to `main`. Set `VITE_API_URL` in the repo's GitHub Actions variables to point to the server (e.g. `https://api.whisker.lmcmillan.dev`).

### Environment variables

Set these in `.env.local` at the repo root:

| Variable | Description | Example |
|---|---|---|
| `DEPLOY_SSH_HOST` | SSH destination for the server | `ubuntu@1.2.3.4` |
| `DEPLOY_SERVER_PORT` | Port the container exposes on the server | `8022` |
| `API_KEY` | API key for authenticating requests. Alphanumeric only (no symbols) | `abc123...` |
| `DEPLOY_CORS_ORIGIN` | Allowed CORS origin for the frontend | `https://whisker.lmcmillan.dev` |
