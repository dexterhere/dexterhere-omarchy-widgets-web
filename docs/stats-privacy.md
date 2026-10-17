# Likes and views: privacy text for the Security page

Draft text for the Security page to adopt when a stats service is actually deployed. Until then
the accurate statement is the first section.

## Today (no service)

Likes are favourites kept in your browser's local storage under the key `ow-liked`. They never
leave your device. No view is counted, nothing is sent anywhere, no cookies are set and no totals
are shown. Clear your site data to remove them.

## When the optional counter service is enabled

The site is built with a single extra allowed address (the stats service); the Content Security
Policy allows connections to that address and no other.

**Sent**

- Reading totals: a `GET` with the widget ids on the page. No identifier is attached.
- Opening a widget page: one `POST /view/<id>` with a random 128-bit identifier in an
  `X-Client-Token` header. At most once per widget per day per browser.
- Liking or unliking: `POST` or `DELETE /like/<id>` with the same identifier.
- Requests carry no cookies and no referrer. Your browser still sends its normal network
  details (IP address, user agent) to any server it contacts; the service does not store or log
  them.

**Stored**

- Two counters per widget.
- Views: an HMAC-SHA-256 of the identifier, the widget and the date, with a server secret.
  Deleted after 48 hours. Tomorrow's hash is unrelated to today's.
- Likes: an HMAC of the identifier and the widget. Deleted when you unlike, or after 400 days.
- Short-lived rate-limit counters keyed by a hash (2 minutes).

**Not stored:** IP addresses, user agents, referrers, the raw identifier, cookies, or anything
that identifies a person.

**Opt out**

- Send Do Not Track (`DNT: 1`) or Global Privacy Control: views are not counted and no identifier
  is created for views. Likes are explicit actions and still work.
- Block the stats origin in your browser or content blocker: the site keeps working, likes stay
  on your device and totals are hidden.
- Remove your identifier by clearing site data (`ow-client`); unlike a widget to delete its like row.

If the service is down or slow (3 second limit), totals are hidden and nothing else changes.
