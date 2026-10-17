const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) =>
    x.toString(16).padStart(2, '0')
  ).join('');

export const TOKEN_TTL_SEC = 30 * 86400;
export const CHALLENGE_TTL_SEC = 120;
export const DEFAULT_POW_BITS = 18;

/** HMAC-SHA-256(secret, message) as hex. */
export async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** Compares without exiting early on the first differing character. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const randomHex = () => hex(crypto.getRandomValues(new Uint8Array(16)));
const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const INT = /^[0-9]{1,12}$/;

// Token: v1.<random>.<expiry seconds>.<hmac>. The random part is the dedupe identity;
// nothing the client picks at write time ever becomes an identity.
export async function signToken(secret: string, nowSec: number) {
  const r = randomHex();
  const exp = nowSec + TOKEN_TTL_SEC;
  return { token: `v1.${r}.${exp}.${await hmac(secret, `tok|v1|${r}|${exp}`)}`, exp };
}

/** Returns the random part of a valid, unexpired token (any listed secret), else null. */
export async function verifyToken(
  secrets: string[],
  token: string | null,
  nowSec: number
): Promise<string | null> {
  if (!token || token.length > 160) return null;
  const [v, r, exp, mac] = token.split('.');
  if (token.split('.').length !== 4 || v !== 'v1') return null;
  if (!HEX32.test(r ?? '') || !INT.test(exp ?? '') || !HEX64.test(mac ?? '')) return null;
  let ok = false;
  for (const s of secrets) ok = timingSafeEqual(await hmac(s, `tok|v1|${r}|${exp}`), mac) || ok;
  return ok && Number(exp) > nowSec ? r : null;
}

// Challenge: <nonce>.<expiry seconds>.<hmac>, valid for 2 minutes and single use.
export async function signChallenge(secret: string, nowSec: number) {
  const nonce = randomHex();
  const exp = nowSec + CHALLENGE_TTL_SEC;
  return `${nonce}.${exp}.${await hmac(secret, `ch|${nonce}|${exp}`)}`;
}

/** Returns the nonce of a valid, unexpired challenge, else null. */
export async function verifyChallenge(
  secrets: string[],
  ch: string | null,
  nowSec: number
): Promise<string | null> {
  if (!ch || ch.length > 160) return null;
  const parts = ch.split('.');
  if (parts.length !== 3) return null;
  const [nonce, exp, mac] = parts;
  if (!HEX32.test(nonce) || !INT.test(exp) || !HEX64.test(mac)) return null;
  let ok = false;
  for (const s of secrets) ok = timingSafeEqual(await hmac(s, `ch|${nonce}|${exp}`), mac) || ok;
  return ok && Number(exp) > nowSec ? nonce : null;
}

export function leadingZeroBits(b: Uint8Array): number {
  let n = 0;
  for (const x of b) {
    if (x === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(x) - 24;
  }
  return n;
}

/** SHA-256(`<challenge>:<solution>`) must start with `bits` zero bits. */
export async function powOk(challenge: string, solution: string | null, bits: number) {
  if (!solution || !/^[0-9a-z]{1,16}$/.test(solution)) return false;
  const d = await crypto.subtle.digest('SHA-256', enc.encode(`${challenge}:${solution}`));
  return leadingZeroBits(new Uint8Array(d)) >= bits;
}

/**
 * Coarse network prefix (IPv4 /24, IPv6 /48) from a platform-supplied address, or null.
 * The address itself is never kept; only a salted hash of the prefix is used, see handler.
 */
export function networkPrefix(ip: string | null): string | null {
  if (!ip || ip.length > 45) return null;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    return v4.slice(1).every((o) => Number(o) <= 255) ? `4:${v4[1]}.${v4[2]}.${v4[3]}` : null;
  }
  if (!/^[0-9a-fA-F:]+$/.test(ip) || !ip.includes(':')) return null;
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1 ? head.length !== 8 : head.length + tail.length > 7) return null;
  const groups = [
    ...head,
    ...Array(halves.length === 2 ? 8 - head.length - tail.length : 0).fill('0'),
    ...tail
  ];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g))) return null;
  return `6:${groups
    .slice(0, 3)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':')}`;
}
