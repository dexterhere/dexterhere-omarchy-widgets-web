// Config for the local dev server. Pure, so it can be unit-tested.
export const DEV_SECRET = 'dev-only-secret-do-not-use-in-production-0000';
export const DEV_ID_SECRET = 'dev-only-id-secret-do-not-use-in-production-000';
export const DEV_ORIGINS = ['http://localhost:4300', 'http://docs.localhost:4300'];
export const DEV_PORT = 8787;

export interface DevConfig {
  secret: string;
  idSecret: string;
  allowedOrigins: string[];
  port: number;
}

/**
 * `STATS_DEV=1` (set by `bun run stats:dev`) allows the throwaway dev secrets. Otherwise
 * SECRET, ID_SECRET (32+ characters) and ALLOWED_ORIGINS must be given explicitly, so a
 * production-looking run can never silently use a public secret.
 */
export function devConfig(env: Record<string, string | undefined>): DevConfig {
  const dev = env.STATS_DEV === '1';
  const secret = env.SECRET || (dev ? DEV_SECRET : '');
  const idSecret = env.ID_SECRET || (dev ? DEV_ID_SECRET : '');
  const origins = (env.ALLOWED_ORIGINS ?? (dev ? DEV_ORIGINS.join(',') : ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (secret.length < 32 || idSecret.length < 32)
    throw new Error('SECRET and ID_SECRET (32+ characters) are required unless STATS_DEV=1');
  if (!dev && (secret === DEV_SECRET || idSecret === DEV_ID_SECRET))
    throw new Error('the dev secrets are public: refusing to use them without STATS_DEV=1');
  if (origins.length === 0 || origins.includes('*'))
    throw new Error('ALLOWED_ORIGINS must list exact origins (no wildcard)');
  const port = Number(env.PORT ?? DEV_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('bad PORT');
  return { secret, idSecret, allowedOrigins: origins, port };
}
