# Stats service (reference backend)

Anonymous view and like counters for the Omarchy Widgets site. Optional: the site works fully
without it (likes stay on the visitor's device, no totals are shown). Plain `fetch(request, env)`
handler, no runtime dependencies. `src/index.ts` is a Cloudflare Worker backed by D1;
`createHandler({ store, ... })` runs anywhere with a `Store` (`src/store.ts`: atomic `incr`,
`setIfAbsent`, `delete` and a batched `getMany`; an in-memory store is included for tests and
single-process hosts).

## Endpoints

| Method and path                        | What it does                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /stats?ids=a,b,c` (max 20 ids)    | `{"stats":{"<id>":{"views":n,"likes":n}}}`; `Cache-Control: public, max-age=30`            |
| `GET /challenge`                       | `{"challenge":"...","bits":18}`, signed, valid 2 minutes                                   |
| `POST /token`                          | Headers `X-Challenge`, `X-Pow` (and optionally `X-Previous-Token` to renew) return a token |
| `POST /view/<id>`                      | Count one view per widget, day and token. `204`                                            |
| `POST /like/<id>`, `DELETE /like/<id>` | Like or unlike, once per widget and token. `204`                                           |
| `OPTIONS *`                            | CORS preflight for an allowed origin                                                       |

**`WIDGET_IDS` is required.** It is the comma-separated list of widget ids the service may count
(generate it from the registry build: `bun run registry && bun services/stats/scripts/emit-widget-ids.ts`,
and paste the output into `wrangler.toml`). Without it every id route answers `503` and creates
nothing. An id outside the list is rejected with `400` and creates no row, so strangers cannot
create counters. Update the list when widgets are added.

Writes need an allowed `Origin` and a valid `X-Client-Token`. Anything else gets a uniform
`{"error":"<code>"}` body that echoes nothing. No endpoint takes a request body: any request with a
body, a non-zero `Content-Length` or a `Transfer-Encoding` gets `413` before a single byte is read
(the stream is cancelled), so chunked or lying requests cannot force reads.

`GET /stats` reads all counters with one batched query, is rate limited like the other routes (60
per minute per fine network prefix, 240 per coarse prefix, 600 shared without an address header),
and uses the Cache API when the platform has it (30 s, keyed by the sorted id list, no CORS data in
the cached body). Browsers and the edge may also cache it for 30 s (`Cache-Control`).

## Tokens and proof of work

Clients cannot choose their identity. A token `v1.<identity>.<expiry>.<hmac>` is issued by the
server (HMAC-SHA-256 with `STATS_SECRET`, 30 days, checked in constant time). To get one the
browser fetches a signed challenge (single use, 2 minutes, difficulty signed in) and finds a value
so that `SHA-256(challenge:value)` has 18 leading zero bits, about a second or two of work in small
time slices that do not block the page. Difficulty rises (a) by 2 bits while many tokens were issued
in the current minute and (b) by 1 bit (up to 4) for each token the requester's coarse network
prefix received in the current hour, never above 22 bits in total. The client refuses to solve
anything above 22 bits so a malicious server cannot burn its CPU, and after a refusal or timeout it
does not try again for 10 minutes (then 20, 40, ... up to 6 hours). The work runs in time slices on
the main thread rather than in a Web Worker: a worker would need its own same-origin script and
bundling, and the slices already keep the page responsive.

**Stable identity.** The dedupe identity is the `<identity>` part. Renewal sends the old token in
`X-Previous-Token`; if its signature is valid (current or previous secret) and it expired less than
a year ago, the new token keeps the same identity, so a like stays revocable and cannot be counted
twice. Renewal still costs a proof of work. A token older than one year, forged or absent starts a
new identity (an old like from it can no longer be removed by that browser, and a new like counts
once more; accepted). Dedupe keys are derived with `ID_SECRET` (falls back to `STATS_SECRET`), not
the signing secret, so rotating `STATS_SECRET` (with `STATS_SECRET_PREVIOUS`) does not orphan likes.
Set `ID_SECRET` once and do not change it: changing it resets all dedupe state.

## What is stored (exact lifetimes)

| Key                                   | Content                                   | Lifetime                     |
| ------------------------------------- | ----------------------------------------- | ---------------------------- |
| `cv:<id>`, `cl:<id>`                  | view and like counters per widget         | permanent                    |
| `v:<id>:<day>:<hmac>`                 | view dedupe, HMAC(secret, day, id, token) | 48 hours                     |
| `l:<id>:<hmac>`                       | like row, HMAC(secret, id, token)         | until you unlike (no expiry) |
| `ch:<nonce>`                          | challenge replay mark                     | 150 seconds                  |
| `r:nw:/nt:/ns:<hash>:<minute>`        | per-network counters, see below           | 2 minutes after the last hit |
| `r:t:<hash>:<minute>`, `r:g:<minute>` | per-token hash and shared counters        | 2 minutes after the last hit |
| `r:ti:m:<minute>`                     | tokens issued this minute (no address)    | 2 minutes after the last hit |
| `r:ti:h:<hour>`                       | tokens issued this hour (no address)      | 2 hours after the last hit   |
| `r:ti:p:<hash>:<hour>`                | per-coarse-prefix issuance, see below     | 1 hour after the last hit    |

Like rows have no expiry on purpose: they are pseudonymous HMACs that must stay revocable, and
expiring one would let the same person like again and inflate the counter. A like can only be
removed by unliking. A daily cron (`purgeExpired`) deletes expired rows; reads already ignore them.

### The transient network-prefix keys

To slow down abuse without keeping addresses, the Worker reads one client address from a header
(default `CF-Connecting-IP`, configurable with `IP_HEADER`), reduces it to coarse prefixes (IPv4
/24 and /16, IPv6 /48 and /32; IPv4-mapped IPv6 counts as IPv4; leading zeros are normalised) and
computes `HMAC(daily salt, prefix)` for each tier, where the salt is `HMAC(secret, UTC date)`. All
tiers must pass. The hash appears only in the rate-limit keys above, with the lifetimes in the
table (at most one hour after the last request). The address and prefix are never stored or logged,
a key is never stored with a widget or combined with a token, and keys change every UTC day.

An address header that is missing, a list (`a, b`, X-Forwarded-For style), or not a single valid
address is treated as no address: all such traffic shares one bucket. **On hosts other than
Cloudflare the header must be set by a trusted proxy that overwrites anything the client sent**
(set `IP_HEADER` to its name); otherwise clients can choose their own prefix and the per-network
limits are bypassable (the token, global and proof-of-work limits still apply).

Not stored and not logged: IP addresses, user agents, referrers, raw tokens, cookies. The handler
never calls `console` and returns generic errors. Turn off platform request logs for the Worker
(`[observability] enabled = false`). Cloudflare itself sees connections at its edge, outside this
code.

`DNT: 1` or `Sec-GPC: 1` on a view request: acknowledged, nothing counted, nothing stored.

## Rate limits (defaults)

Per minute: token issuance requests (`/challenge`, `/token`) 6 per fine prefix and 24 per coarse
prefix (60 shared without an address); writes 120 per fine prefix, 480 per coarse prefix, 30 per
token and 1200 shared; `/stats` as above. The network limit runs before any token work.

Token issuance has three layers, all returning `429` with `Retry-After`:

1. each coarse prefix (a /16 or /32) may be issued 30 tokens per hour, and its difficulty rises
   with every one (the share is checked first, so an exhausted prefix does not use up the rest);
2. 120 tokens per minute in total;
3. 3000 tokens per hour in total.

The totals are an **availability trade-off**: a distributed flood across many prefixes can still
use them up and delay token issuance for everyone for up to an hour. That only delays counting new
views and likes (likes stay on each device and counts are hidden); it never blocks the site. They are set well above expected
organic traffic (a handful of new browsers per minute) so normal use never meets them.

## Residual risk

A determined attacker can still inflate counts by paying the proof of work for each token, across
many networks. Counts are a popularity signal, not an authority: never use likes or views to gate
anything security-relevant (ranking trust, tiers, review status). A site without a configured
service shows "Like (saved on this device)" and no numbers, and must never show invented ones.
Raise `createHandler({ powBits })` or add a Cloudflare rate-limiting rule if abuse shows up.

## Run it locally

```sh
bun run registry      # once, for registry/dist/index.json (the widget ids)
bun run stats:dev     # http://127.0.0.1:8787, in-memory store (counts reset on restart)
PUBLIC_STATS_URL=http://localhost:8787 bun run build   # a site build that talks to it
```

Defaults are for development only: public throwaway secrets, allowed origins
`http://localhost:4300` and `http://docs.localhost:4300`, ids from the registry build. Override with
`SECRET`, `ID_SECRET`, `ALLOWED_ORIGINS`, `WIDGET_IDS`, `PORT`, `POW_BITS` (lower it to make token
requests instant). It listens on 127.0.0.1 only. Without `STATS_DEV=1` (which `stats:dev` sets) it
refuses to start unless real secrets (32+ characters) and exact origins are given.

## Deploy (maintainer task)

1. `wrangler d1 create omarchy-widgets-stats`, put the id in `wrangler.toml` (placeholders only in
   the repo), then `wrangler d1 execute omarchy-widgets-stats --remote --file=schema.sql`.
2. Set `ALLOWED_ORIGINS` to the exact site origin(s), no wildcard, and `WIDGET_IDS` from
   `scripts/emit-widget-ids.ts`.
3. `wrangler secret put STATS_SECRET` and `wrangler secret put ID_SECRET`, each 32 or more random
   bytes (`openssl rand -hex 32`). To rotate the signing secret: set `STATS_SECRET_PREVIOUS` to the
   old value and `STATS_SECRET` to the new one, and remove the old one after a year (renewal grace).
   Never change `ID_SECRET`.
4. `wrangler deploy`.
5. Build the site with `PUBLIC_STATS_URL=https://<worker-origin>`. The CSP `connect-src` gains
   exactly that origin.

## Privacy statement (quoted by the Security page)

> Optional counters: when enabled, opening a widget first asks the counter service for a token
> (your browser does a small calculation to get it). The token is a random value made by the
> server, kept in your browser's local storage (never a cookie). The server hashes it with a secret
> (and the date, for views) and keeps only the hash: for 48 hours for views, and for likes until you
> unlike. No IP address, browser details or referrer is stored or logged. To limit abuse, salted,
> daily-rotating hashes of your network prefix (not your address) are kept for at most an hour,
> only as rate-limit counters. If your browser sends Do Not Track or Global Privacy Control, views
> are not counted. Counts are a popularity signal and can be inflated. Without the service nothing
> is sent and your likes stay on your device.
