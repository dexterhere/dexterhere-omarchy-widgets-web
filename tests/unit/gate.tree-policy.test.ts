import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkPolicy, canonPath } from '../../scripts/gate/check-policy';
import { checkProviders, type Catalog } from '../../scripts/gate/check-providers';
import { scanSvg, scanTree } from '../../scripts/gate/scan-tree';
import { safe } from '../../scripts/gate/safe';

const f = (path: string, over = {}) => ({ path, mode: '100644', type: 'blob', size: 10, ...over });
const ok = [f('manifest.json'), f('widget.json'), f('layout.json'), f('LICENSE'), f('README.md')];

describe('scanTree', () => {
  it('accepts a normal spec widget', () => expect(scanTree(ok)).toEqual([]));
  it.each([
    ['symlink', f('a.qml', { mode: '120000' }), /symlink/],
    ['submodule', f('sub', { mode: '160000', type: 'commit' }), /submodule/],
    ['traversal', f('a/../b.qml'), /unsafe path/],
    ['absolute', f('/etc/x.json'), /unsafe path/],
    ['confusable name', f('cаlendar.qml'), /non-ASCII/],
    ['bidi name', f('x‮gpj.json'), /non-ASCII/],
    ['binary', f('run.so'), /not allowed/],
    ['shell script', f('install.sh'), /not allowed/],
    ['oversized', f('big.json', { size: 2_000_000 }), /over/],
    ['case collision', f('Layout.json'), /only by case/]
  ])('rejects %s', (_n, extra, re) => {
    expect(scanTree([...ok, extra]).join()).toMatch(re);
  });
  it('flags missing entry points and too many files', () => {
    expect(scanTree([f('README.md')]).join()).toMatch(/manifest\.json: missing/);
    const many = Array.from({ length: 301 }, (_, i) => f(`f${i}.json`));
    expect(scanTree([...ok, ...many]).join()).toMatch(/more than/);
  });
  it.each([
    ['missing size', { size: undefined }],
    ['string size', { size: '5' as unknown as number }],
    ['NaN size', { size: NaN }],
    ['negative size', { size: -1 }]
  ])('a blob with %s is an error', (_n, over) =>
    expect(scanTree([...ok, f('a.qml', over)]).join()).toMatch(/size/)
  );
  it.each([
    '.git/config',
    '.GIT/config',
    'sub/.Git/hooks/x.json',
    '.github/workflows/x.json',
    '.env',
    'a/.hidden.json',
    'a/.gitignore',
    'a\\b.json',
    '.git./x.json',
    'a/b .json/'
  ])('rejects path %s', (p) => expect(scanTree([...ok, f(p)]).length).toBeGreaterThan(0));
  it('allows a root .gitignore only', () => expect(scanTree([...ok, f('.gitignore')])).toEqual([]));
  it('never echoes workflow-command text or control characters', () => {
    const msgs = scanTree([...ok, f('::error::pwned/x.exe'), f('a\nb::set-output.sh')]).join('\n');
    expect(msgs).not.toContain('::');
    expect(msgs).not.toMatch(/[\x00-\x09\x0b-\x1f]/);
    expect(msgs.split('\n').every((l) => l.length < 200)).toBe(true);
  });
  it('allows qmldir and LICENSE without extensions', () => {
    expect(scanTree([...ok, f('qmldir')])).toEqual([]);
  });
});

const caps = (c: Partial<{ network: string[]; files: string[]; spawn: string[] }> = {}) => ({
  network: [],
  files: [],
  spawn: [],
  ...c
});
const own = '~/.config/omarchy/plugins/io.github.a.b';

describe('checkPolicy truth table', () => {
  const base = { tier: 'code' as const, classes: ['local-system'], ownDir: own };
  it('passes a plain local-system code widget', () =>
    expect(checkPolicy({ ...base, capabilities: caps({ spawn: ['date'] }) })).toEqual([]));
  it('spec widgets declare nothing', () =>
    expect(
      checkPolicy({
        ...base,
        tier: 'spec',
        capabilities: caps({ network: ['example.com'] })
      }).join()
    ).toMatch(/spec widgets/));
  it('code widgets cannot use sensitive classes', () =>
    expect(checkPolicy({ ...base, classes: ['personal'], capabilities: caps() }).join()).toMatch(
      /public or local-system/
    ));
  it('no sensitive provider with network (exfil rule)', () =>
    expect(
      checkPolicy({
        ...base,
        tier: 'spec',
        classes: ['personal'],
        capabilities: caps({ network: ['example.com'] })
      }).join()
    ).toMatch(/combines a sensitive provider/));
  it('mail is rejected', () =>
    expect(
      checkPolicy({ ...base, tier: 'spec', classes: ['secret-mail'], capabilities: caps() }).join()
    ).toMatch(/mail/));
  it.each(['127.0.0.1', 'localhost', 'printer.local', '10.0.0.1', 'a_b.com', '*.example.com'])(
    'rejects network host %s',
    (h) =>
      expect(checkPolicy({ ...base, capabilities: caps({ network: [h] }) }).length).toBeGreaterThan(
        0
      )
  );
  it.each([
    '127.1',
    '0x7f.1',
    '127.0.1',
    '0177.1',
    '0x7f.0x0.0x0.0x1',
    '2130706433',
    '1.2.3.4',
    '[::1]',
    '::1',
    'localhost',
    'a.localhost',
    'x.local',
    'x.internal',
    'x.lan',
    'router.home.arpa',
    'x.corp',
    'x.intranet',
    '10.0.0.1.nip.io',
    'a.sslip.io',
    'a.xip.io',
    'nip.io',
    'intranet',
    'Example.com',
    'exämple.com',
    'a..com',
    '-a.com'
  ])('rejects bad network host %s', (h) =>
    expect(checkPolicy({ ...base, capabilities: caps({ network: [h] }) }).join()).toMatch(/network/)
  );
  it.each(['example.com', 'api.github.com', 'xn--bcher-kva.example', 'a-b.example.org'])(
    'accepts network host %s',
    (h) => expect(checkPolicy({ ...base, capabilities: caps({ network: [h] }) })).toEqual([])
  );
  it.each([
    '~/.ssh/id_ed25519',
    '~/.aws',
    '~/.config/gh/hosts.yml',
    '$XDG_DATA_HOME/owd/vault.owv',
    '/var/run/docker.sock',
    '~/.config/omarchy/plugins/../../../.ssh/id_rsa',
    '/proc/self/environ',
    '~//.ssh//id',
    '~/*',
    '/run/user/1000/podman/podman.sock'
  ])('rejects files %s', (p) =>
    expect(checkPolicy({ ...base, capabilities: caps({ files: [p] }) }).length).toBeGreaterThan(0)
  );
  it('allows only the own plugin directory', () => {
    expect(checkPolicy({ ...base, capabilities: caps({ files: [`${own}/data`] }) })).toEqual([]);
    expect(checkPolicy({ ...base, capabilities: caps({ files: ['~/Documents'] }) }).join()).toMatch(
      /own plugin directory/
    );
  });
  it.each(['sh', 'bash', 'python3.12', 'env', 'curl', 'docker', 'hyprctl', 'xargs'])(
    'rejects spawn %s',
    (s) =>
      expect(checkPolicy({ ...base, capabilities: caps({ spawn: [s] }) }).join()).toMatch(
        /allow-list/
      )
  );
  it('canonPath collapses and rejects', () => {
    expect(canonPath('~/a//b/../c/')).toBe('~/a/c');
    expect(canonPath('relative/x')).toBeNull();
    expect(canonPath('~/a/*')).toBeNull();
  });
});

describe('checkProviders against registry/providers.json', () => {
  const cat = JSON.parse(readFileSync('registry/providers.json', 'utf8')) as Catalog;
  it('every fixture widget matches the catalog', () => {
    for (const d of readdirSync('registry/fixtures')) {
      const w = JSON.parse(readFileSync(`registry/fixtures/${d}/widget.json`, 'utf8'));
      expect(checkProviders(w, cat).problems, d).toEqual([]);
    }
  });
  it('rejects unknown provider, topic, field and wrong auth', () => {
    const w = (p: object) => ({ providers: [p as never] });
    expect(
      checkProviders(w({ name: 'evil', topics: ['x.y'], fields: [] }), cat).problems.join()
    ).toMatch(/not in the catalog/);
    expect(
      checkProviders(
        w({ name: 'system', topics: ['system.nope'], fields: [] }),
        cat
      ).problems.join()
    ).toMatch(/unknown topic/);
    expect(
      checkProviders(
        w({ name: 'system', topics: ['system.time'], fields: ['secret'] }),
        cat
      ).problems.join()
    ).toMatch(/field secret/);
    expect(
      checkProviders(
        w({ name: 'github', topics: ['github.prs'], fields: ['open'], auth: 'none' }),
        cat
      ).problems.join()
    ).toMatch(/auth is vault/);
  });
  it('prototype-named providers are not found', () => {
    expect(
      checkProviders(
        { providers: [{ name: 'constructor', topics: ['a.b'], fields: [] }] },
        cat
      ).problems.join()
    ).toMatch(/not in the catalog/);
  });
});

describe('safe()', () => {
  it('neutralises control characters and workflow commands, and truncates', () => {
    expect(safe('::error::x\n::warning::y')).not.toContain('::');
    expect(safe('a\r\nb\u202ec')).toBe('a??b?c');
    expect(safe('x'.repeat(500)).length).toBeLessThanOrEqual(121);
  });
});

describe('scanSvg (allow-list)', () => {
  const NS = 'xmlns="http://www.w3.org/2000/svg"';
  const svg = (inner: string, attrs = '') => `<svg ${NS} viewBox="0 0 8 8"${attrs}>${inner}</svg>`;
  it('accepts a plain svg', () => {
    expect(scanSvg('a.svg', svg('<path d="M0 0L8 8" fill="none" stroke="#fff"/>'))).toEqual([]);
    expect(
      scanSvg(
        'a.svg',
        '<?xml version="1.0"?>\n<!-- c -->\n' +
          svg(
            '<defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs><g clip-path="url(#c)"><title>a &amp; b</title><rect width="4" height="4" fill="url(#g)"/><rect fill="rgba(1, 2, 3, 0.5)" stroke="#abcd"/><rect fill="currentColor" stroke="none"/></g>'
          )
      )
    ).toEqual([]);
  });
  it.each([
    ['script', svg('<script>alert(1)</script>')],
    ['SCRIPT', svg('<SCRIPT >x</SCRIPT>')],
    ['prefixed script', svg('<svg:script>x</svg:script>')],
    ['prefixed foreignObject', svg('<x:foreignObject/>')],
    ['foreignObject', svg('<foreignObject/>')],
    ['style element', svg('<style>a{fill:red}</style>')],
    ['image', svg('<image href="a.png"/>')],
    ['use', svg('<use href="#a"/>')],
    ['a', svg('<a href="x"/>')],
    ['animate', svg('<animate attributeName="href" to="javascript:alert(1)"/>')],
    ['set', svg('<set attributeName="href" to="javascript:alert(1)"/>')],
    ['text', svg('<text>x</text>')],
    ['onload', svg('', ' onload="x()"')],
    ['ONCLICK spaced', svg('<rect ONCLICK = "x()"/>')],
    ['href attr', svg('<path href="x"/>')],
    ['xlink:href attr', svg('<path xlink:href="x"/>')],
    ['xmlns:xlink', svg('', ' xmlns:xlink="http://www.w3.org/1999/xlink"')],
    ['foreign xmlns', '<svg xmlns="http://evil/ns"/>'],
    ['style attribute', svg('<rect style="fill:red"/>')],
    ['class attribute', svg('<rect class="a"/>')],
    ['javascript in value', svg('<path fill="javascript:x"/>')],
    ['char ref javascript', svg('<path fill="&#106;avascript:x"/>')],
    ['css escape in url', svg('<rect fill="u\\72l(https://evil/x)"/>')],
    ['css escape javascript', svg('<path d="\\6a avascript:x"/>')],
    ['backslash anywhere', svg('<path d="M0 0\\\\"/>')],
    ['paint: arbitrary word', svg('<rect fill="expression(x)"/>')],
    ['paint: url with extra', svg('<rect fill="url(#a) red"/>')],
    ['paint: url with dot id', svg('<rect fill="url(#a.b)"/>')],
    ['paint: unknown keyword', svg('<rect stroke="rebeccapurple"/>')],
    ['paint: rgb with letters', svg('<rect fill="rgb(a,b,c)"/>')],
    ['paint: bad hex length', svg('<rect fill="#12345"/>')],
    ['clip-path non-url', svg('<g clip-path="inset(1px)"/>')],
    ['mask external', svg('<g mask="url(https://evil/m)"/>')],
    ['named ref colon', svg('<path fill="javascript&colon;x"/>')],
    ['hex char ref in text', svg('<title>&#x6a;</title>')],
    ['data: with whitespace', svg('<path fill="d\tata:text/html,x"/>')],
    ['url to external', svg('<rect fill="url(https://evil/x)"/>')],
    ['url hidden by control chars', svg('<rect fill="u&#x72;l(https://evil)"/>')],
    ['DOCTYPE', '<!DOCTYPE svg><svg/>'],
    ['ENTITY', '<!DOCTYPE svg [<!ENTITY a "b">]>' + svg('')],
    ['CDATA', svg('<title><![CDATA[x]]></title>')],
    ['processing instruction', '<?xml-stylesheet href="x"?>' + svg('')],
    ['unquoted attribute', svg('<rect width=4/>')],
    ['unterminated tag', '<svg ' + NS + '><rect'],
    ['unterminated comment', '<!-- x ' + svg('')],
    ['mismatched close', svg('<g></rect>')],
    ['unclosed', '<svg ' + NS + '><g>'],
    ['empty', ''],
    ['not svg root', '<g/>']
  ])('rejects %s', (_n, s) => expect(scanSvg('a.svg', s).length).toBeGreaterThan(0));
  it('never echoes svg content', () =>
    expect(scanSvg('a.svg', svg('<script>SECRETVALUE</script>')).join()).not.toContain(
      'SECRETVALUE'
    ));
});
