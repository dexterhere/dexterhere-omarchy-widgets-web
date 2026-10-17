# Stats service (reference backend)

Anonymous view and like counters for the Omarchy Widgets site. Optional: the site works fully
without it (likes stay on the visitor's device, no totals are shown). Plain `fetch(request, env)`
handler, no runtime dependencies. `src/index.ts` is a Cloudflare Worker with a KV store;
`createHandler({ store, ... })` runs anywhere with a `Store` (see `src/store.ts`; an in-memory
store is included for tests).

## Endpoints

| Method and path                        | What it does                                            |
| -------------------------------------- | ------------------------------------------------------- |
| `GET /stats?ids=a,b,c` (max 50 ids)    | `{"stats":{"<id>":{"views":n,"likes":n}}}`, cached 30 s |
| `POST /view/<id>`                      | Count one view per widget, day and browser. `204`       |
| `POST /like/<id>`, `DELETE /like/<id>` | Like or unlike, once per widget and browser. `204`      |
| `OPTIONS *`                            | CORS preflight for an allowed origin                    |

Ids must match the registry id shape (`io.github.owner.name`, at most 128 characters). Writes need
an allowed `Origin` and an `X-Client-Token` header (32 hex characters). Anything else gets a
uniform `{"error":"<code>"}` body that echoes nothing. Bodies over 1 KB are refused.

## What is stored

- Per widget: two counters (`c:<id>` = views, likes).
- View dedupe row `v:<id>:<day>:<hmac>`: HMAC-SHA-256 of (secret, UTC day, widget, client token).
  The day is part of the input, so a browser has an unrelated key every day. Expires after 48
  hours.
- Like row `l:<id>:<hmac>`: HMAC of (secret, widget, client token). It must outlive a day so a like
  can be revoked, and expires after 400 days. Keys of different widgets cannot be linked.
- Rate-limit counters `r:<hmac or g>:<minute>`: expire after 2 minutes.

Not stored and not logged: IP addresses, user agents, referrers, the raw client token, cookies.
The handler never calls `console` and returns generic errors. Turn off platform request logs for
the Worker (`[observability] enabled = false` in `wrangler.toml`). Cloudflare itself sees
connections at the network edge, which is outside this code.

`DNT: 1` or `Sec-GPC: 1` on a view request: acknowledged, nothing counted, nothing stored.

## Rate limiting

A fixed window per minute, keyed by the HMAC of the client token (30 writes) and one coarse global
bucket (1200 writes). No IPs are used. A client can mint new tokens, so the global bucket is the
real flood guard; add Cloudflare's own rate limiting rule on the route for per-IP limits, which
Cloudflare enforces without this code ever seeing the address.

## Known limits

- KV read-modify-write is not atomic: simultaneous writes to one widget can lose a count. Use a
  Durable Object or D1 if exact totals matter.
- Counters for any id with a valid shape can be created. Set `WIDGET_IDS` to restrict them.
- A like older than 400 days can be re-added (the row has expired). That is one extra count at most.

## Deploy (maintainer task)

1. `wrangler kv namespace create STATS`, copy the id into `wrangler.toml` (the file ships with
   placeholders only).
2. Set `ALLOWED_ORIGINS` to the exact site origin(s), no wildcard.
3. `wrangler secret put STATS_SECRET` with 32 or more random bytes (`openssl rand -hex 32`).
   Rotating it resets all dedupe state (counts are kept).
4. `wrangler deploy`.
5. Build the site with `PUBLIC_STATS_URL=https://<worker-origin>`. The CSP `connect-src` gains
   exactly that origin.

## Privacy statement (quoted by the Security page)

> Optional counters: when enabled, opening a widget sends one request carrying a random
> identifier made on your device, stored in your browser's local storage (never a cookie). The
> server hashes it with a secret (and the date, for views) and keeps only the hash, for 48 hours
> for views and until you unlike for likes. It stores no IP address, browser details or referrer.
> If your browser sends Do Not Track or Global Privacy Control, views are not counted. Without
> the service, nothing is sent and your likes stay on your device.
