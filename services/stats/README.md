# Stats service (reference backend)

Anonymous view and like counters for the Omarchy Widgets site. Optional: the site works fully
without it (likes stay on the visitor's device, no totals are shown). Plain `fetch(request, env)`
handler, no runtime dependencies. `src/index.ts` is a Cloudflare Worker backed by D1;
`createHandler({ store, ... })` runs anywhere with a `Store` (`src/store.ts`: atomic `incr` and
`setIfAbsent`; an in-memory store is included for tests and single-process hosts).

## Endpoints

| Method and path                        | What it does                                              |
| -------------------------------------- | --------------------------------------------------------- |
| `GET /stats?ids=a,b,c` (max 50 ids)    | `{"stats":{"<id>":{"views":n,"likes":n}}}`, cached 30 s   |
| `GET /challenge`                       | `{"challenge":"...","bits":18}`, signed, valid 2 minutes  |
| `POST /token`                          | Header `X-Challenge` + `X-Pow` (solution) returns a token |
| `POST /view/<id>`                      | Count one view per widget, day and token. `204`           |
| `POST /like/<id>`, `DELETE /like/<id>` | Like or unlike, once per widget and token. `204`          |
| `OPTIONS *`                            | CORS preflight for an allowed origin                      |

Ids must match the registry id shape (`io.github.owner.name`, at most 128 characters). Writes need
an allowed `Origin` and a valid `X-Client-Token`. Anything else gets a uniform `{"error":"<code>"}`
body that echoes nothing. Request bodies over 1 KB are refused.

## Tokens and proof of work

Clients cannot choose their identity. A token `v1.<random>.<expiry>.<hmac>` is issued by the
server (HMAC-SHA-256 with `STATS_SECRET`, 30 days, checked in constant time). To get one the
browser must fetch a signed challenge (single use, 2 minutes) and find a value so that
`SHA-256(challenge:value)` has 18 leading zero bits, about a second or two of work in small time
slices that do not block the page. The dedupe identity is the random part of the token.
`STATS_SECRET_PREVIOUS` keeps tokens signed by the old secret valid while rotating.

## What is stored

- Counters per widget: `cv:<id>` (views), `cl:<id>` (likes).
- View dedupe row `v:<id>:<day>:<hmac>`: HMAC-SHA-256 of (secret, UTC day, widget, token random
  part). The day is part of the input, so a browser has an unrelated key every day. 48 hours.
- Like row `l:<id>:<hmac>`: HMAC of (secret, widget, token random part). It must outlive a day so a
  like can be revoked, and expires after 400 days. Keys of different widgets cannot be linked.
- Challenge replay marks `ch:<nonce>` (150 s) and rate-limit counters `r:...:<minute>` (2 minutes).
- A daily cron deletes expired rows (`purgeExpired`); reads already ignore them.

### The transient network-prefix key

To slow down abuse without keeping addresses, the Worker reads the platform's client address header
(`CF-Connecting-IP`), reduces it to a coarse prefix (IPv4 /24, IPv6 /48), and computes
`HMAC(daily salt, prefix)`, where the salt is `HMAC(secret, UTC date)`. That hash is used only as
part of a rate-limit counter key (`r:nw:<hash>:<minute>`, `r:nt:<hash>:<minute>`) that expires within
two minutes (never more than an hour). The address and prefix are not stored or logged, the key is
never stored with a widget and never combined with a token, and it changes every UTC day. Without
the header (local development) all traffic shares one bucket.

Not stored and not logged: IP addresses, user agents, referrers, raw tokens, cookies. The handler
never calls `console` and returns generic errors. Turn off platform request logs for the Worker
(`[observability] enabled = false`). Cloudflare itself sees connections at its edge, outside this
code.

`DNT: 1` or `Sec-GPC: 1` on a view request: acknowledged, nothing counted, nothing stored.

## Rate limits (per minute, defaults)

Token issuance (`/challenge` and `/token`): 6 per network prefix, 60 shared. Writes: 120 per network
prefix, 30 per token, 1200 shared. All counters are atomic.

## Residual risk

A determined attacker can still inflate counts by paying the proof-of-work for each token (and by
using many networks). Counts are a popularity signal, not an authority: never use likes or views to
gate anything security-relevant (ranking trust, tiers, review status). A site without a configured
service shows "Like (saved on this device)" and no numbers, and must never show invented ones.
Raise the difficulty in `createHandler({ powBits })` or add a Cloudflare rate-limiting rule if abuse
shows up.

## Deploy (maintainer task)

1. `wrangler d1 create omarchy-widgets-stats`, put the id in `wrangler.toml` (placeholders only in
   the repo), then `wrangler d1 execute omarchy-widgets-stats --remote --file=schema.sql`.
2. Set `ALLOWED_ORIGINS` to the exact site origin(s), no wildcard.
3. `wrangler secret put STATS_SECRET` with 32 or more random bytes (`openssl rand -hex 32`). To
   rotate: set `STATS_SECRET_PREVIOUS` to the old value, `STATS_SECRET` to the new one, and remove
   the old one after 30 days. Rotation resets dedupe (counts are kept).
4. `wrangler deploy`.
5. Build the site with `PUBLIC_STATS_URL=https://<worker-origin>`. The CSP `connect-src` gains
   exactly that origin.

## Privacy statement (quoted by the Security page)

> Optional counters: when enabled, opening a widget first asks the counter service for a token
> (your browser does a small calculation to get it). The token is a random value made by the
> server, kept in your browser's local storage (never a cookie). The server hashes it with a secret
> (and the date, for views) and keeps only the hash, for 48 hours for views and until you unlike for
> likes. No IP address, browser details or referrer is stored or logged. To limit abuse, a salted,
> daily-rotating hash of your network prefix (not your address) is kept for at most a few minutes,
> only as a rate-limit counter. If your browser sends Do Not Track or Global Privacy Control, views
> are not counted. Counts are a popularity signal and can be inflated. Without the service nothing
> is sent and your likes stay on your device.
