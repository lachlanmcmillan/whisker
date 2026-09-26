import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const origin = process.env.WHISKER_TEST_ORIGIN ?? "http://localhost:8787";
const apiKey = /^API_KEY=(.*)$/m
  .exec(readFileSync(".dev.vars", "utf8"))?.[1]
  ?.replace(/^"|"$/g, "");
assert(apiKey);

async function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  key?: string
) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

const ownerEmail = "lachy.mcm@gmail.com";
const ownerPassword = "local-test-owner-password-123";
const memberEmail = "member-test@example.com";
const memberPassword = "local-test-member-password-456";

const bootstrap = await call(
  "/auth/bootstrap",
  "POST",
  { email: ownerEmail },
  undefined,
  apiKey
);
assert.equal(bootstrap.status, 200, JSON.stringify(bootstrap.body));
const setupToken = new URL(bootstrap.body.data.setupUrl).hash.split("=")[1];
const setup = await call("/auth/accept", "POST", {
  token: setupToken,
  password: ownerPassword,
});
assert.equal(setup.status, 200, JSON.stringify(setup.body));
const ownerCookie = setup.cookie!;
assert.equal(
  (await call("/auth/me", "GET", undefined, ownerCookie)).body.data.email,
  ownerEmail
);
assert.equal((await call("/feeds", "GET")).status, 401);
assert.equal(
  (await call("/query", "POST", { sql: "SELECT * FROM Users" }, ownerCookie))
    .status,
  404
);

const invitation = await call(
  "/auth/invites",
  "POST",
  { email: memberEmail },
  ownerCookie
);
assert.equal(invitation.status, 201, JSON.stringify(invitation.body));
const inviteToken = new URL(invitation.body.data.inviteUrl).hash.split("=")[1];
const accepted = await call("/auth/accept", "POST", {
  token: inviteToken,
  password: memberPassword,
});
assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
const memberCookie = accepted.cookie!;
assert.equal(
  (
    await call("/auth/accept", "POST", {
      token: inviteToken,
      password: memberPassword,
    })
  ).status,
  400
);
assert.equal(
  (await call("/auth/users", "GET", undefined, memberCookie)).status,
  403
);

const added = await call(
  "/feeds",
  "POST",
  { url: "https://hnrss.org/frontpage" },
  ownerCookie
);
assert.equal(added.status, 201, JSON.stringify(added.body));
const ownerFeeds = await call("/feeds", "GET", undefined, ownerCookie);
assert.equal(ownerFeeds.body.data.length, 1);
assert.equal(
  (await call("/feeds", "GET", undefined, memberCookie)).body.data.length,
  0
);
const feed = ownerFeeds.body.data[0];
assert(feed.entries.length > 0);
assert.equal(
  (await call(`/feeds/${feed.id}/refresh`, "POST", undefined, memberCookie))
    .status,
  404
);
assert.equal(
  (
    await call(
      `/entries/${feed.id}/${encodeURIComponent(feed.entries[0].entryId)}`,
      "PATCH",
      { openedAt: new Date().toISOString() },
      memberCookie
    )
  ).status,
  404
);
assert.equal(
  (
    await call(
      `/feeds/${feed.id}/tags`,
      "POST",
      { name: "private" },
      ownerCookie
    )
  ).status,
  200
);
assert.equal(
  (await call("/tags", "GET", undefined, memberCookie)).body.data.length,
  0
);
assert.equal(
  (
    await call(
      "/feeds",
      "POST",
      { url: "https://hnrss.org/frontpage" },
      memberCookie
    )
  ).status,
  201
);
const memberFeed = (await call("/feeds", "GET", undefined, memberCookie)).body
  .data[0];
assert.equal(memberFeed.id, feed.id);
assert.equal(memberFeed.tags.length, 0);
const entryId = encodeURIComponent(feed.entries[0].entryId);
assert.equal(
  (
    await call(
      `/entries/${feed.id}/${entryId}`,
      "PATCH",
      { openedAt: new Date().toISOString() },
      ownerCookie
    )
  ).status,
  200
);
assert.equal(
  (await call("/feeds", "GET", undefined, memberCookie)).body.data[0].entries[0]
    .openedAt,
  null
);
assert.equal(
  (await call(`/feeds/${feed.id}`, "PATCH", { title: "My title" }, ownerCookie))
    .status,
  200
);
assert.notEqual(
  (await call("/feeds", "GET", undefined, memberCookie)).body.data[0].title,
  "My title"
);
assert.equal(
  (await call(`/feeds/${feed.id}`, "DELETE", undefined, ownerCookie)).status,
  200
);
assert.equal(
  (await call("/feeds", "GET", undefined, memberCookie)).body.data.length,
  1
);
console.log(
  "Local owner, invite, session, and two-user isolation checks passed"
);
