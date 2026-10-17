# Likes and views: privacy text for the Security page

Draft text for the Security page to adopt when a stats service is actually deployed. Until then
the accurate statement is the first section.

## Today (no service)

Likes are favourites kept in your browser's local storage under the key `ow-liked`. They never
leave your device. No view is counted, nothing is sent anywhere, no cookies are set and no totals
are shown. The interface says "Like (saved on this device)". Clear your site data to remove them.

## When the optional counter service is enabled

The site is built with a single extra allowed address (the stats service); the Content Security
Policy allows connections to that address and no other.

**Sent**

- Reading totals: a `GET` with the widget ids on the page. No identifier is attached.
- Getting a token (once per 30 days, only when you first like something or open a widget): a
  `GET /challenge`, a small calculation in your browser (a proof of work, a second or two, done in
  short slices so the page stays responsive), then a `POST /token`. The token is random and made by
  the server.
- Opening a widget page: one `POST /view/<id>` with the token in an `X-Client-Token` header. At
  most once per widget per day per browser.
- Liking or unliking: `POST` or `DELETE /like/<id>` with the same token.
- Requests carry no cookies and no referrer. Your browser still sends its normal network details
  (IP address, user agent) to any server it contacts; the service does not store or log them.

**Stored**

- Two counters per widget.
- Views: an HMAC-SHA-256 of the token's random part, the widget and the date, with a server
  secret. Deleted after 48 hours. Tomorrow's hash is unrelated to today's.
- Likes: an HMAC of the token's random part and the widget. Deleted when you unlike, or after 400
  days.
- For abuse limits only: a counter keyed by a salted hash of your network prefix (IPv4 /24 or
  IPv6 /48, never the full address). The salt changes every day and the counter expires within
  minutes (never more than an hour). It is not stored with a widget, a token or a like, and the
  prefix itself is never written anywhere.

**Not stored:** IP addresses, user agents, referrers, raw tokens, cookies, or anything that
identifies a person.

**Opt out**

- Send Do Not Track (`DNT: 1`) or Global Privacy Control: views are not counted and no token is
  requested for views. Likes are explicit actions and still work.
- Block the stats origin in your browser or content blocker: the site keeps working, likes stay
  on your device and totals are hidden.
- Remove your token by clearing site data (`ow-token`); unlike a widget to delete its like row.

**Limits of the numbers:** counts are a popularity signal. Someone willing to do the proof of work
for each token can inflate them, so they never decide anything security-relevant (trust tiers,
review status, ranking of safety).

If the service is down or slow (3 second limit), totals are hidden and nothing else changes.
