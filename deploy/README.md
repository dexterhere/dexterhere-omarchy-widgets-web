# Deploying the site and the docs on two hostnames

One build, two hostnames. The product site lives at `https://example.com`, the docs at `https://docs.example.com`. Both are served from the same `build/` directory; the hosting layer decides what a request means from the `Host` header.

Nothing here is required. Without the two settings below the site is a plain static site with the docs under `/docs/`.

## 1. Build with the two origins

```bash
PUBLIC_SITE_ORIGIN=https://example.com \
PUBLIC_DOCS_ORIGIN=https://docs.example.com \
bun run build
```

Both or neither. Origins only (`http(s)://host[:port]`, no path, query or credentials), different hostnames; anything else stops the build. `http:` is accepted only for `localhost`, `*.localhost`, `127.0.0.1` and `[::1]` (use https for real domains); trailing dots, port 0, labels starting or ending with a hyphen and numeric or hex IP spellings such as `2130706433` or `0x7f.1` are refused. They are baked into the links, so rebuild when a domain changes. `.env.example` lists them.

## 2. Generate the host rules

```bash
PUBLIC_SITE_ORIGIN=https://example.com \
PUBLIC_DOCS_ORIGIN=https://docs.example.com \
bun run emit:host-config
```

This writes `Caddyfile`, `nginx.conf`, `netlify/_redirects`, `netlify/_headers` and `vercel.json` into this folder. The files committed here use the placeholder origins `example.com` and `docs.example.com`; regenerate them for your domains (a unit test keeps the placeholders in sync with the code). Never edit them by hand: change `src/lib/hosts.ts` instead.

## The rules

| Host | Request                                                                   | Result                         |
| ---- | ------------------------------------------------------------------------- | ------------------------------ |
| docs | `/`                                                                       | 302 to the latest start page   |
| docs | `/_app/*`, `/pagefind/*`, `/favicon.svg`, `/theme-boot.js`, `/robots.txt` | served as-is                   |
| docs | `/docs/*`                                                                 | 308 to `/*` on the docs origin |
| docs | anything else, `/x`                                                       | serves the build's `/docs/x`   |
| site | `/docs/*`                                                                 | 308 to the docs origin         |
| site | anything else                                                             | served as-is                   |
| any  | not found                                                                 | `404.html`                     |
| any  | `/400/`, `/404/`, `/500/` (and `/…/index.html` under them)                | served as-is, with their HTML  |

## Error pages

Each host answers with the designed error pages from the build, with the status the visitor needs:

- **Not found** (any host, any unknown path): `404.html` with status **404**. It is the same page as the prerendered `/404/`, copied by `scripts/finalize-errors.ts` so it also renders without JavaScript.
- **Bad request**: Caddy (`handle_errors`) and nginx (`error_page 400`) serve `/400/index.html` with status 400.
- **Server errors** (nginx `500 502 503 504`, Caddy `>= 500`): `/500/index.html`, status kept. A static build has no upstream, so these only occur when a proxy or the host itself fails.
- **Netlify and Vercel**: they serve `404.html` for unmatched paths with status 404 by themselves; `netlify/_redirects` and `vercel.json` rewrite the `/400/`, `/404/` and `/500/` directories so they also work on the docs host. Netlify and Vercel do not map 400 or 5xx to our pages (their `_redirects` and `routes` have no status mapping for that here); not tested on those products.

Redirect targets are always the configured docs origin plus the request path, never a value taken from the `Host` header. Directories get a trailing slash (`trailingSlash: 'always'`); links in the site always carry it.

## Headers and unknown hosts

Every template sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` (the page's meta CSP cannot express `frame-ancestors`; it stays for everything else). Pagefind files get the right type: `wasm.*.pagefind` is `application/wasm`, the `pf_*` index files `application/octet-stream`. Netlify takes these from `netlify/_headers` (copy it next to `_redirects`), Vercel from the `headers` section of `vercel.json`. `serve-local` sends the same headers.

Caddy and nginx also answer **421** for any other Host header (a catch-all server), so the build is not served under a name you did not configure. Caddy and nginx redirects are built from the escaped request URI (`{uri}` and `$request_uri`), so `%3F`, `%23`, quotes and CR/LF stay escaped and never change meaning; this is checked in `tests/unit/hosts.docker.test.ts`, which runs both configs in real containers and is skipped when Docker or the images are not there. Caddy collapses `//` in the path before redirecting; the target is still the docs origin.

## Which hosts can do it

| Host             | Host-based rewrites | How                                                                                                                            |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Caddy            | yes                 | `Caddyfile`                                                                                                                    |
| nginx            | yes                 | `nginx.conf` (include it in `http { }`)                                                                                        |
| Netlify          | yes                 | `netlify/_redirects`, copy it to the published directory (`build/_redirects`)                                                  |
| Vercel           | yes                 | `vercel.json` at the project root                                                                                              |
| Cloudflare       | yes, with a Worker  | snippet below, static assets binding                                                                                           |
| **GitHub Pages** | **no**              | One site per repository, cannot route or rewrite by hostname. The docs stay at `/docs/` there: build without the two settings. |

Netlify, Vercel, nginx and Caddy output was generated and unit-tested, but not run against those products here: try it on a preview deployment and check the list under "Check it" first.

### Cloudflare Worker

Serve `build/` as Workers static assets, route both hostnames to the Worker and use:

```js
const DOCS = 'https://docs.example.com';
const KEEP = ['/_app/', '/pagefind/'];
const FILES = ['/favicon.svg', '/theme-boot.js', '/robots.txt'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p === '/docs' || p.startsWith('/docs/'))
      return Response.redirect(DOCS + (p.slice('/docs'.length) || '/') + url.search, 308);
    if (url.hostname === new URL(DOCS).hostname) {
      if (p === '/') return Response.redirect(DOCS + '/next/start/what-it-is/' + url.search, 302);
      if (!KEEP.some((k) => p.startsWith(k)) && !FILES.includes(p)) url.pathname = '/docs' + p;
    }
    return env.ASSETS.fetch(new Request(url, request));
  }
};
```

Replace `/next/start/what-it-is/` with the start page that `bun run emit:host-config` prints.

## DNS and TLS

- Two DNS records pointing at the host: `example.com` and `docs.example.com` (A/AAAA or CNAME, as your host wants). A wildcard record is not needed.
- A certificate that covers both names (one certificate with two names, or a wildcard). Caddy and Netlify/Vercel/Cloudflare issue them automatically; with nginx use certbot.
- The docs origin must be a hostname of the same registrable domain as the site (`docs.example.com` for `example.com`). The site sets no cookies, so this is not a technical limit, but it keeps one zone and one certificate, and the theme carry-over (below) assumes you control both.

## Theme continuity

`localStorage` is per origin, so the theme chosen on one host would be lost on the other. Links between the two hosts get `?theme=<id>` when clicked; `theme-boot.js` applies it only if it is one of the known theme ids, stores it and removes the parameter from the address. Nothing else in the query string is touched. No cookies.

## Check it

After deploying, with your own domains:

```bash
curl -sI https://docs.example.com/ | grep -i -E '^(HTTP|location)'              # 302 to /<latest>/start/...
curl -sI https://example.com/docs/next/start/what-it-is/ | grep -i -E '^(HTTP|location)'  # 308 to docs host
curl -sI https://docs.example.com/docs/next/start/what-it-is/ | grep -i -E '^(HTTP|location)'  # 308 to /next/...
curl -sI https://docs.example.com/_app/version.json | head -1                    # 200
curl -sI 'https://docs.example.com/docs//evil.example/' | grep -i location       # stays on the docs host
```

## Local check

`bun run serve:local` serves both hosts on 127.0.0.1 (`localhost` and `docs.localhost`, port 4300) from a separate build in `build-hosts/`, applying the same rules from `src/lib/hosts.ts`.
