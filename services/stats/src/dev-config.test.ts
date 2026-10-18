import { describe, expect, it } from 'vitest';
import { DEV_ORIGINS, DEV_SECRET, devConfig } from '../scripts/dev-config';

describe('dev server config', () => {
  it('uses dev defaults only with STATS_DEV=1', () => {
    const c = devConfig({ STATS_DEV: '1' });
    expect(c.allowedOrigins).toEqual(DEV_ORIGINS);
    expect(c.port).toBe(8787);
    expect(c.secret).toBe(DEV_SECRET);
  });
  it('refuses to start without explicit secrets outside dev mode', () => {
    expect(() => devConfig({})).toThrow(/required/);
    expect(() => devConfig({ SECRET: 's'.repeat(40) })).toThrow(/required/);
    expect(() =>
      devConfig({ SECRET: 'short', ID_SECRET: 'short', ALLOWED_ORIGINS: 'https://a.org' })
    ).toThrow();
  });
  it('refuses the public dev secrets outside dev mode', () => {
    expect(() =>
      devConfig({ SECRET: DEV_SECRET, ID_SECRET: 'i'.repeat(40), ALLOWED_ORIGINS: 'https://a.org' })
    ).toThrow(/public/);
  });
  it('accepts explicit production-style values and rejects wildcards or no origins', () => {
    const ok = {
      SECRET: 's'.repeat(40),
      ID_SECRET: 'i'.repeat(40),
      ALLOWED_ORIGINS: 'https://a.org'
    };
    expect(devConfig(ok).allowedOrigins).toEqual(['https://a.org']);
    expect(() => devConfig({ ...ok, ALLOWED_ORIGINS: '*' })).toThrow();
    expect(() => devConfig({ ...ok, ALLOWED_ORIGINS: '' })).toThrow();
    expect(() => devConfig({ ...ok, PORT: '99999' })).toThrow();
  });
});
