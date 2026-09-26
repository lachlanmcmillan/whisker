# Whisker

A feed reader that runs in your browser.

## How it works

The SolidJS frontend uses a Cloudflare Worker API. The Worker fetches RSS and Atom feeds and discovers feed URLs from web pages. D1 stores shared feed content alongside private subscriptions, tags, and reading state. Accounts are invite only, and the browser signs in with email and password using an HTTP-only session cookie.

You can add one or many feeds at once, browse entries in grid or list view, organize feeds with tags, mark entries read, archive or star entries, and refresh feeds. Bulk imports validate every line before saving anything. A cron trigger refreshes feeds whose configured interval is due every five minutes.

## Local development

Put `API_KEY="your-key"` in the gitignored `.dev.vars` file and run `bun dev`. This applies migrations to a local D1 database, builds the frontend assets used by Wrangler, starts the Worker on port 8787, and starts Vite on port 6173. Open `http://localhost:6173`; Vite proxies API requests to the local Worker. Frontend edits update through Vite hot reload. The local D1 database is separate from production.

For a new local database, call `POST http://localhost:6173/auth/bootstrap` with `Authorization: Bearer <API_KEY>` and JSON `{ "email": "owner@example.com" }`. Change port 8787 to 6173 in the returned one-time setup URL, then set the owner's password. Bootstrap is disabled after the owner is active.

`bun run worker:dev` serves a built frontend directly through Wrangler on port 8787.

## Deployment

Current deployment: https://whisker.lachy-mcm-services.workers.dev

1. Authenticate Wrangler with `bunx wrangler login` or set `CLOUDFLARE_API_TOKEN`.
2. The `whisker` D1 database is bound in `wrangler.jsonc`. For a different Cloudflare account, create a database with `bunx wrangler d1 create whisker --location apac` and replace its database ID there.
3. Apply the schema with `bun run worker:d1:remote`.
4. Put a long random `API_KEY="your-key"` in the gitignored `.dev.vars` file. It is used once to create the first owner setup link.
5. Deploy with `bun run worker:deploy`. This uploads the secret with the Worker.
6. Call `POST /auth/bootstrap` with `Authorization: Bearer <API_KEY>` and JSON `{ "email": "owner@example.com" }`. Open the returned one-time setup URL and set the owner's password.

The owner can create one-time invitation and reset links on the Account screen and share them privately. Owner setup and invitations expire after seven days; reset links expire after one hour. There is no email delivery service yet. Passwords use scrypt (`N=16384, r=8, p=5`) with a unique random salt.
