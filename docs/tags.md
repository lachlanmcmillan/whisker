# Tags for Feeds

## Problem Statement

User wants to organize feeds into arbitrary user-defined groups (e.g. "economics"). A feed may belong to many groups; a group may span many feeds. Today the schema has tables but no API or model logic.

## Solution

Many-to-many tags between feeds and tags. CRUD for tags, assign/unassign on feeds, and tags surfaced inline on feed reads.

## Detailed Requirements

- A tag has only `id` and `name`
- Tag names are trimmed of leading/trailing whitespace
- Tag names are normalized to lowercase
- Tag names must be 1..32 chars after trim (empty/whitespace-only rejected)
- Tag names accept any unicode characters
- Tag name uniqueness enforced (case-insensitive via lowercase normalization)
- A tag can be created standalone via `POST /tags`
- A tag can be created implicitly when assigning a name to a feed
- All tags can be listed via `GET /tags` (bare list, no counts, no feed ids)
- A tag can be renamed via `PUT /tags/:id`
- Renaming to an existing name returns 409 conflict (no merge)
- A tag can be deleted via `DELETE /tags/:id`
- Deleting a tag cascades through `FeedTags` (existing FK behavior)
- A feed's tags can be listed via `GET /feeds/:id/tags`
- A tag can be assigned to a feed via `POST /feeds/:id/tags` body `{tagId}` or `{name}`
- Assignment with `{name}` auto-creates the tag if not exists
- Assignment is idempotent (re-assign returns 200, no duplicate)
- A tag can be unassigned via `DELETE /feeds/:id/tags/:tagId`
- Unassign is idempotent (unassign of missing returns 200)
- Tags are referenced by id in URL paths
- Tags are returned inline on `GET /feeds` per feed
- Tags are returned inline on `PATCH /feeds/:id` response
- Entries responses do not include tags
- `POST /feeds/:id/tags` returns the tag `{id, name}`
- All endpoints follow existing `Result<T>` / `json()` / `errorStatus()` conventions

## Implementation Decisions

- Single model module `tags.model.ts` covering both tag CRUD and feed-tag join ops (no separate `feedTags.model.ts`)
- Functions: `readAll`, `readById`, `create(name)`, `rename(id, name)`, `remove(id)`, `readForFeed(feedId)`, `assign(feedId, tagOrName)`, `unassign(feedId, tagId)`, plus an internal `normalizeName(name)`
- `feeds.model.ts` extended so `readAll` and `readWithEntriesById` return tags inline (single batched query rather than N+1)
- New routes file `routes/tags.ts` for `/tags` endpoints
- Existing `routes/feeds.ts` extended with handlers for `/feeds/:id/tags` and `/feeds/:id/tags/:tagId`
- Dispatcher in `routes/index.ts` updated for new pathnames
- Validation errors use `invalid_input` code; conflicts use a new code (e.g. `tag_conflict`); not-found uses `tag_not_found`
- Tag names are normalized once at the model boundary (trim + lowercase); routes pass raw input through
- Idempotent assign uses `INSERT OR IGNORE` on FeedTags; idempotent unassign uses bare DELETE (no row count check)
- Auto-create-on-assign performs upsert by name then insert into FeedTags

## Assumptions

- Existing migration `20260419093656_tags` is the source of truth for the schema (no further migration needed)
- Tag name uniqueness via the existing `Tags_name_key` unique index is sufficient since names are normalized lowercase before insert
- Inline tags on `GET /feeds` is acceptable to return as a new `tags: [{id, name}]` field on each feed row (response shape change)
- API key auth (when configured) covers tag endpoints same as feeds endpoints — tags routed after the auth gate in dispatcher
- Sort order for inline tags: by id ascending (insertion order); for `GET /tags`: by name ascending
- No client work in scope for this iteration

## Verification

Tests live alongside `tags.model.ts`:

- `create` trims leading/trailing whitespace from name
- `create` lowercases the name
- `create` rejects empty string with `invalid_input`
- `create` rejects whitespace-only string with `invalid_input`
- `create` rejects >32 char name with `invalid_input`
- `create` returns existing tag when name already exists (no duplicate)
- `rename` updates name on success
- `rename` to a name owned by another tag returns `tag_conflict`
- `rename` to its own current name returns ok
- `remove` deletes the tag
- `remove` cascades and removes its FeedTags rows
- `assign` by tagId attaches tag to feed
- `assign` by name auto-creates tag if missing
- `assign` is idempotent when already attached
- `unassign` detaches tag from feed
- `unassign` is idempotent when not attached
- `readForFeed` returns tags attached to that feed only, sorted by id
- `feeds.readAll` returns each feed with `tags` array inline
- `feeds.readWithEntriesById` returns the feed with `tags` array inline

## Out of Scope

- Browse-by-tag UI / filter API
- Inline tags on entry responses
- Bulk replace of feed tags via PATCH `/feeds/:id`
- Tag merging on rename conflict
- Tag colors, descriptions, or metadata beyond name
- Pagination of `/tags`
- Frontend client changes

## Interview

**Q1: Tag CRUD ops needed?**
all of the above

**Q2: Assignment API shape?**
A — separate endpoints

**Q3: Auto-create on assign or strict?**
A — accepts `{name}`, auto-creates

**Q4: Still need standalone POST /tags?**
do both

**Q5: Rename — PATCH or PUT?**
PUT

**Q6: Rename name conflict?**
409

**Q7: Delete tag with feeds attached?**
cascade

**Q8: Inline tags on GET /feeds?**
inline

**Q9: GET /tags shape?**
bare

**Q10: Name validation rules?**
trim, normalize case, max 32 chars, any chars, no empty

**Q11: Reference by id or name in URL?**
id everywhere

**Q12: Idempotent assign/unassign?**
idempotent both

**Q13: POST /feeds/:id/tags response?**
return tag

**Q14: Inline tags on which reads?**
GET & PATCH

**Q15: Fold feedTags into tags.model? Tests?**
fold; you choose tests

**Q16: GET /feeds/:id/tags?**
separate
