// F1: a hostile 1 MB file must not freeze the (synchronous) registry build. Every gate regex is
// exercised with pathological input and must finish quickly.
import { describe, expect, it } from 'vitest';
import { badHost, checkPolicy } from '../../scripts/gate/check-policy';
import { lintFile } from '../../scripts/gate/lint-code';
import { normaliseText, scanSecrets } from '../../scripts/gate/scan-secrets';
import { scanSvg, scanTree } from '../../scripts/gate/scan-tree';
import { safe } from '../../scripts/gate/safe';

const M = 1024 * 1024;
const rep = (s: string, len = M) => s.repeat(Math.ceil(len / s.length)).slice(0, len);
/** Same repetition, but broken into short lines so line-length guards do not hide the cost. */
const lines = (s: string, len: number, every = 120) =>
  rep(s, len).replace(new RegExp(`(.{${every}})`, 'g'), '$1\n');
const none = { network: false, files: false, spawn: false };
const FAST = 500;
const time = (f: () => unknown) => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

const UNITS = [
  'a',
  ' ',
  '\n',
  '[',
  '{',
  '(',
  '"',
  "'",
  '`',
  '`${',
  '/',
  '/*',
  '//',
  '\\u00',
  '\\x',
  'Text { ',
  'Text{',
  'Label {',
  'import ',
  'import "',
  'source: ',
  'source:"',
  '.source =',
  'Qt',
  'Qt.',
  'Qt .',
  'Quickshell',
  'Hyprland',
  '"+"',
  '" + "',
  'a://u:',
  'a+',
  'http://',
  ':',
  '@',
  'password = ',
  'api_key=',
  'secret: "',
  'token: `',
  'Bearer ',
  'eyJ',
  'eyJaaaaaaaa.',
  'M',
  'AKIA',
  'aws_secret',
  'xox',
  'sk-',
  'ghp_',
  '<',
  '<svg ',
  '<svg a="b" ',
  '<!--',
  '&',
  'x["',
  'x[',
  ')[',
  ']['
];

describe('every gate regex stays fast on pathological input', () => {
  it.each(UNITS)('lintFile, 250 KB of %j in short lines', (u) => {
    expect(time(() => lintFile('a.qml', lines(u, 250 * 1024), none))).toBeLessThan(FAST);
  });
  it.each(UNITS)('lintFile, 250 KB of %j with no line breaks', (u) => {
    expect(time(() => lintFile('a.qml', rep(u, 250 * 1024), none))).toBeLessThan(FAST);
  });
  it('lintFile refuses a file over 256 KB without running regexes', () => {
    const t = time(() => {
      const r = lintFile('a.qml', rep('a ', 600 * 1024), none);
      expect(r.map((f) => f.rule)).toContain('file-size');
    });
    expect(t).toBeLessThan(FAST);
  });
  it('lintFile skips the regex rules when a line is over 400 characters', () => {
    const r = lintFile('a.qml', 'eval("1")\n' + 'x'.repeat(401), none);
    expect(r.map((f) => f.rule)).toEqual(['long-line']);
  });
  it.each(UNITS)('scanSecrets, 1 MB of %j in short lines', (u) => {
    expect(time(() => scanSecrets('f', lines(u, M)))).toBeLessThan(FAST);
  });
  it.each(UNITS)('scanSecrets, 1 MB of %j with no line breaks', (u) => {
    expect(time(() => scanSecrets('f', rep(u, M)))).toBeLessThan(FAST);
  });
  it('scanSecrets on the reviewer PoCs', () => {
    expect(time(() => scanSecrets('f', rep('a://u:', M)))).toBeLessThan(FAST);
    expect(time(() => scanSecrets('f', 'a+'.repeat(262144) + '://'))).toBeLessThan(FAST);
    expect(time(() => normaliseText(rep('"+"', M)))).toBeLessThan(FAST);
  });
  it('lint dynamic-member on 50k identifiers followed by brackets', () => {
    expect(
      time(() => lintFile('a.qml', lines('a', 200 * 1024, 100) + 'a["x"]', none))
    ).toBeLessThan(FAST);
  });
  it('lint Text bodies in one pass', () => {
    expect(time(() => lintFile('a.qml', lines('Text { ', 250 * 1024, 100), none))).toBeLessThan(
      FAST
    );
  });
  it.each(UNITS)('scanSvg, 1 MB of %j', (u) => {
    expect(
      time(() => scanSvg('a.svg', '<svg xmlns="http://www.w3.org/2000/svg">' + rep(u, M)))
    ).toBeLessThan(FAST);
  });
  it.each(UNITS)('scanTree and policy helpers, long names made of %j', (u) => {
    const p = rep(u, 200 * 1024);
    expect(
      time(() => {
        scanTree([{ path: p, mode: '100644', type: 'blob', size: 1 }]);
        badHost(p);
        safe(p);
        checkPolicy({
          tier: 'code',
          capabilities: { network: [p], files: [p], spawn: [p] },
          classes: [],
          ownDir: '~/x'
        });
      })
    ).toBeLessThan(FAST);
  });
});
