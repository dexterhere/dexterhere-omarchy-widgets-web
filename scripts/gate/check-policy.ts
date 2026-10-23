// Gate G5 (capability policy): allow-lists, not deny-lists. Pure functions over a parsed widget.json.
// The files denylist and spawn allow-list are listing policy and a speed bump for review; they
// do not sandbox anything (a code widget runs as the user).
import { posix } from 'node:path';

/** Paths no widget may ask for, after canonicalisation. Prefix match on whole segments. */
export const FILES_DENY = [
  '~/.ssh',
  '~/.gnupg',
  '~/.aws',
  '~/.kube',
  '~/.docker',
  '~/.netrc',
  '~/.git-credentials',
  '~/.config/gh',
  '~/.config/gcloud',
  '~/.local/share/keyrings',
  '~/.config/omarchy/plugins',
  '~/.local/share/owd',
  '~/.config/owd',
  '~/.claude',
  '~/.codex',
  '~/.mozilla',
  '~/.config/google-chrome',
  '~/.config/chromium',
  '$XDG_DATA_HOME/owd',
  '$XDG_CONFIG_HOME/owd',
  '$XDG_RUNTIME_DIR/owd',
  '$XDG_RUNTIME_DIR/hypr',
  '/proc',
  '/sys',
  '/etc/shadow',
  '/etc/sudoers',
  '/run/docker.sock',
  '/var/run/docker.sock'
];

/** Exact program names a code widget may spawn. Everything else is rejected. */
export const SPAWN_ALLOW = new Set(['date', 'uname', 'uptime', 'free', 'df', 'sensors', 'nproc']);

const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
// A last label that is a number (decimal, 0x hex, leading-0 octal) makes URL parsers read the whole
// name as an IPv4 address in any notation (127.1, 0x7f.1, 0177.1), so reject it.
const NUMERIC = /^(0x[0-9a-f]*|\d+)$/;
const PRIVATE_TLD = new Set([
  'localhost',
  'local',
  'internal',
  'lan',
  'corp',
  'intranet',
  'home',
  'localdomain'
]);
const PRIVATE_SUFFIX = ['home.arpa', 'nip.io', 'sslip.io', 'xip.io'];

/** True for names that are not plain public hostnames: IPs in any notation, private or wildcard-DNS names. */
export function badHost(h: string): boolean {
  if (h.length > 253 || !HOST.test(h)) return true; // also rejects IPv6, uppercase, non-ASCII, single labels
  const labels = h.split('.');
  if (NUMERIC.test(labels[labels.length - 1]) || labels.every((l) => NUMERIC.test(l))) return true;
  return (
    PRIVATE_TLD.has(labels[labels.length - 1]) ||
    PRIVATE_SUFFIX.some((x) => h === x || h.endsWith(`.${x}`))
  );
}

/** Collapse `..`, `//` and `.`; reject globs and non-absolute shapes. Returns null if unusable. */
export function canonPath(p: string): string | null {
  if (/[*?[\]{}\\\0]/.test(p)) return null;
  if (!/^(~|\$XDG_[A-Z_]+|\/)/.test(p)) return null;
  const n = posix.normalize(p).replace(/\/+$/, '');
  return n === '' ? '/' : n;
}

const under = (p: string, root: string) => p === root || p.startsWith(root + '/');

export interface PolicyInput {
  tier: 'spec' | 'code';
  capabilities: { network: string[]; files: string[]; spawn: string[] };
  /** Catalog class of every provider the widget uses. */
  classes: string[];
  /** Plugin directory the widget may read, canonical form, e.g. ~/.config/omarchy/plugins/<id>. */
  ownDir?: string;
}

export function checkPolicy(w: PolicyInput): string[] {
  const out: string[] = [];
  const { network, files, spawn } = w.capabilities;
  const sensitive = w.classes.some((c) => c !== 'public' && c !== 'local-system');
  if (w.tier === 'spec' && (network.length || files.length || spawn.length))
    out.push('spec widgets declare no network, files or spawn');
  if (w.tier === 'code' && sensitive)
    out.push('code widgets may only use public or local-system providers (listing policy)');
  if (sensitive && (network.length || files.length || spawn.length))
    out.push('no widget combines a sensitive provider with its own network, files or spawn');
  if (w.classes.includes('secret-mail')) out.push('mail providers are not available in v1');
  for (const h of network)
    if (badHost(h))
      out.push(`network ${h}: hostnames only, no IP literals, localhost or private names`);
  for (const f of files) {
    const c = canonPath(f);
    if (!c) {
      out.push(`files ${f}: not a plain absolute path (globs and odd characters are rejected)`);
      continue;
    }
    if (w.ownDir && under(c, w.ownDir)) continue; // the widget's own directory sits inside the plugins denylist entry
    if (
      FILES_DENY.some((d) => under(c, d)) ||
      /docker\.sock|podman.*\.sock|\/\.mozilla|browser/i.test(c)
    )
      out.push(`files ${f}: protected location`);
    else if (!(w.ownDir && under(c, w.ownDir)))
      out.push(`files ${f}: only the widget's own plugin directory is allowed`);
  }
  for (const s of spawn) if (!SPAWN_ALLOW.has(s)) out.push(`spawn ${s}: not on the allow-list`);
  return out;
}
