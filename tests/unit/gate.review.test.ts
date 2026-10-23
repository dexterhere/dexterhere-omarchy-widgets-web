// Findings from the independent review of PR #52 (F2-F6). One failing-first test per bypass.
import { describe, expect, it } from 'vitest';
import { lintFile } from '../../scripts/gate/lint-code';
import { scanSecrets } from '../../scripts/gate/scan-secrets';
import { scanSvg, scanTree } from '../../scripts/gate/scan-tree';
import { runGates } from '../../scripts/gate/run';

const none = { network: false, files: false, spawn: false };
const errs = (src: string, d: object = none, file = 'a.qml') =>
  lintFile(file, src, { ...none, ...d }).filter((f) => f.level === 'error');
const caught = (src: string, d: object = none) => expect(errs(src, d).length).toBeGreaterThan(0);
const clean = (src: string, d: object = none) => expect(errs(src, d)).toEqual([]);

describe('F2: code hidden in files the lint never reads', () => {
  const tree = new Set(['Main.qml', 'Other.qml', 'evil.png', 'evil.txt', 'sub/Part.qml']);
  const ctx = { tree };
  it.each([
    ['Loader into a png', 'Loader { source: "evil.png" }'],
    ['Loader into a txt', 'Loader { source: "evil.txt" }'],
    ['Loader into a missing qml', 'Loader { source: "Missing.qml" }'],
    ['unknown type is treated as Loader', 'Foo { source: "evil.png" }'],
    ['Image into a qml', 'Image { source: "Other.qml" }'],
    ['Image into a txt', 'Image { source: "evil.txt" }'],
    ['AnimatedImage into json', 'AnimatedImage { source: "x.json" }'],
    [
      'assignment inside a function (type unknown)',
      'Item { function f() { img.source = "evil.png" } }'
    ]
  ])('catches %s', (_n, src) => caught(src, ctx));
  it('accepts an existing qml for Loader and image files for image types', () => {
    clean('Loader { source: "Other.qml" }', ctx);
    clean('Loader { source: "sub/Part.qml" }', ctx);
    clean('Image { source: "icons/a.png" }', ctx);
    clean('Image { source: Qt.resolvedUrl("a.svg") }', ctx);
    clean('FontLoader { source: "f.ttf" }', ctx);
  });
  const run = (entries: string[], texts: Record<string, string>) =>
    runGates({
      id: 'io.github.a.b',
      widget: {
        tier: 'code',
        providers: [],
        capabilities: { network: [], files: [], spawn: [] }
      },
      entries: ['manifest.json', 'widget.json', ...entries].map((path) => ({
        path,
        mode: '100644',
        type: 'blob',
        size: 10
      })),
      catalog: { schemaVersion: 0, providers: {} },
      readText: async (p) => texts[p] ?? '{}'
    });
  it('warns when a data file looks like QML', async () => {
    const r = await run(['notes.txt'], { 'notes.txt': 'Item {\n  width: 10\n}' });
    expect(r.warnings.join()).toMatch(/looks like QML in a data file/);
  });
  it('rejects a qmldir that maps a type to a non-qml file', async () => {
    const r = await run(['qmldir', 'evil.png'], { qmldir: 'Evil 1.0 evil.png\n' });
    expect(r.errors.join()).toMatch(/qmldir/);
    const ok = await run(['qmldir', 'Evil.qml'], {
      qmldir: 'Evil 1.0 Evil.qml\n',
      'Evil.qml': 'Item {}'
    });
    expect(ok.errors).toEqual([]);
  });
  it('fails a Loader whose target is not in the tree via runGates', async () => {
    const r = await run(['Main.qml'], {
      'Main.qml': 'import QtQuick\nLoader { source: "evil.png" }'
    });
    expect(r.errors.join()).toMatch(/source/);
  });
});

describe('F3: normaliser and rule gaps', () => {
  it.each([
    ['regex literal hides a quote', 'var r = /"/; Qt.include("x"); var s = "\\""'],
    ['regex literal with apostrophe', "var r = /'/; Qt.include('x'); var t = 'a'"],
    ['regex after return', 'function f(){ return /"/.test(x) } Qt.include("x"); var s = "\\""'],
    [
      'ambiguous slash after paren with quotes',
      'if (a) /"/.test(b); Qt.include("x"); var s = "\\""'
    ],
    ['CR ends a line comment', '// c\rQt.include("x")'],
    ['LS ends a line comment', '// c\u2028Qt.include("x")'],
    ['PS ends a line comment', '// c\u2029Qt.include("x")'],
    [
      'computed constructor key',
      'var c="constr"+"uctor"; var F=(function(){})[c]; F("Qt.quit()")()'
    ],
    ['bracket after )', 'getObj()[k]("x")'],
    ['bracket after ]', 'a[0][k]("x")'],
    ['complex index', 'a[f(x)]'],
    ['dangerous word by concatenation', 'var c = "ev" + "al"'],
    ['bare eval', 'var e = eval'],
    ['bare Function', 'var F = Function'],
    ['setSource', 'loader.setSource("x.qml")'],
    ['createComponent bare', 'var c = Qt.createComponent'],
    ['createObject', 'comp.createObject(parent)'],
    ['createQmlObject bare', 'var f = createQmlObject'],
    ['source assignment http', 'Item { Component.onCompleted: img.source = "http://e/x.png" }'],
    [
      'source assigned from Qt.binding',
      'Item { Component.onCompleted: source = Qt.binding(function(){ return a }) }'
    ],
    ['onStatusChanged assignment', 'Image { onStatusChanged: source = "http://e" }'],
    ['Binding on source', 'Binding { target: img; property: "source"; value: "http://e/x.png" }'],
    ['fragmentShader', 'ShaderEffect { fragmentShader: "http://e/s.qsb" }'],
    ['textFormat only in nested item', 'Text { Item { textFormat: Text.PlainText } }'],
    ['textFormat in comment', 'Text { /* textFormat: Text.PlainText */ }'],
    [
      'textFormat runtime assignment',
      'Text { textFormat: Text.PlainText; Component.onCompleted: textFormat = Text.RichText }'
    ],
    ['textFormat ternary', 'Text { textFormat: x ? Text.PlainText : Text.RichText }'],
    ['textFormat ||', 'Text { textFormat: Text.PlainText || Text.RichText }'],
    ['StyledText', 'Text { textFormat: Text.StyledText }'],
    [
      'second text without the format',
      'Item { Text { textFormat: Text.PlainText } Text { text: "x" } }'
    ]
  ])('catches %s', (_n, src) => caught(src));
  it('does not hang or crash on odd input', () => {
    expect(() => lintFile('a.qml', 'a = /[/ b / c', none)).not.toThrow();
  });
  it('still accepts ordinary division and index access', () => {
    clean('Item { property real x: (a + b) / 2; property real y: w / 3 / 4 }');
    clean('Item { function f(a, i) { return a[i] + a[i - 1] + a[0] + a[a.length - 1] } }');
    clean('Item { function f(s) { return s.replace(/a/g, "b") + 1 } }');
  });
});

describe('F4: capabilities against the code', () => {
  const d = { network: true, spawn: true, spawnList: ['date'], networkList: ['example.com'] };
  it.each([
    ['sh -c', 'Process { command: ["sh", "-c", "date"] }'],
    ['undeclared program', 'Process { command: ["uname"] }'],
    ['non-literal command', 'Process { command: [prog, "-a"] }'],
    ['execDetached program', 'Quickshell.execDetached(["curl", "x"])'],
    ['undeclared host', 'Item { property string u: "https://evil.example/x" }'],
    ['bare host', 'Item { property string u: "evil.com" }'],
    ['undeclared websocket host', 'Item { property string u: "wss://evil.example/s" }']
  ])('catches %s', (_n, src) => caught(src, d));
  it('accepts the declared program and host', () => {
    expect(errs('Process { command: ["date", "+%H"] }', d)).toEqual([]);
    expect(errs('Item { property string u: "https://example.com/a" }', d)).toEqual([]);
    expect(errs('Item { property string u: "Main.qml"; property string v: "v1.beta" }', d)).toEqual(
      []
    );
  });
});

describe('F5: benign code is accepted and rules say how to fix them', () => {
  it.each([
    'Item { property int a: Qt.AlignLeft; property int b: Qt.Horizontal }',
    'MouseArea { cursorShape: Qt.PointingHandCursor }',
    'Item { Keys.onPressed: (e) => { if (e.key === Qt.Key_Escape) e.accepted = true } }',
    'Image { source: Quickshell.iconPath("firefox") }'
  ])('accepts %s', (src) => clean(src));
  it.each([
    ['Qt.quit()'],
    ['Qt.exit(1)'],
    ['var c = Qt.rgba(1,2,3,1)'],
    ['Qt.Include("x")()'.replace('Include', 'include')]
  ])('still blocks %s', (src) => caught(src));
  it('names a workaround in each message', () => {
    for (const src of [
      'Qt.quit()',
      'a["x"]',
      'Text { text: "a" }',
      'Image { source: x }',
      'import QtWebEngine',
      'eval("1")'
    ])
      for (const f of errs(src))
        expect(f.message, f.rule).toMatch(
          /\b(use|set|declare|remove|write|add|put|bundle|call|point|import|split|break)\b/i
        );
  });
  const NS = 'xmlns="http://www.w3.org/2000/svg"';
  const svg = (inner: string, attrs = '') => `<svg ${NS}${attrs}>${inner}</svg>`;
  it.each([
    ['class', svg('<rect class="a b"/>')],
    ['data attribute', svg('<rect data-name="x"/>')],
    ['dasharray', svg('<path d="M0 0" stroke-dasharray="1 2" stroke-dashoffset="3"/>')],
    ['xml:space', svg('<title xml:space="preserve">a</title>')],
    ['currentcolor lowercase', svg('<rect fill="currentcolor"/>')],
    ['extended colour keyword', svg('<rect fill="rebeccapurple" stroke="darkslategray"/>')]
  ])('svg accepts %s', (_n, s) => expect(scanSvg('a.svg', s)).toEqual([]));
  it.each([
    ['metadata', svg('<metadata/>')],
    ['sodipodi', svg('<sodipodi:namedview/>')],
    ['xml:space other', svg('<title xml:space="default">a</title>')],
    ['data- with bad value', svg('<rect data-x="javascript:1"/>')]
  ])('svg still rejects %s and says what to do', (_n, s) => {
    const r = scanSvg('a.svg', s);
    expect(r.length).toBeGreaterThan(0);
    expect(r.join()).toMatch(/plain SVG/);
  });
  const f = (path: string) => ({ path, mode: '100644', type: 'blob', size: 5 });
  const base = [f('manifest.json'), f('widget.json')];
  it.each([
    'README',
    'CHANGELOG',
    'LICENSE',
    '.editorconfig',
    '.gitattributes',
    'a.gif',
    '.github/workflows/ci.yml',
    '.github/ISSUE_TEMPLATE/bug.md'
  ])('tree allows %s', (p) =>
    expect(
      scanTree(
        [...base, f(p)].concat(
          p.startsWith('.github') ? [{ ...f('.github'), type: 'tree', mode: '040000' }] : []
        )
      )
    ).toEqual([])
  );
  it.each([
    'Makefile',
    '.github/x.sh',
    '.github/a.js',
    '.githubx/a.md',
    '.git/config',
    'sub/.editorconfig',
    '.env'
  ])('tree still rejects %s', (p) => expect(scanTree([...base, f(p)]).length).toBeGreaterThan(0));
});

describe('F6: secrets evasions', () => {
  const gh = 'ghp_' + 'a'.repeat(36);
  const A = (n: number, c = 'a') => c.repeat(n);
  it.each([
    ['comment between halves', '"ghp_' + A(18) + '" /* x */ + "' + A(18) + '"'],
    ['zero-width inside token', 'ghp_' + A(10) + '\u200b' + A(26)],
    ['BOM and NUL', '\ufeffghp_' + A(10) + '\u0000' + A(26)],
    ['join array', '["ghp_' + A(18) + '","' + A(18) + '"].join("")'],
    ['join array single quotes', "['ghp_" + A(18) + "', '" + A(18) + "'].join('')"],
    ['template split', '`ghp_' + A(18) + '${"' + A(18) + '"}`'],
    ['unquoted password', 'password = hunter2hunter2hunter2'],
    ['unquoted api_key', 'api_key=abcdefghijklmnopqrstu'],
    ['backtick value', 'api_key = `abcdefghijklmnop`'],
    ['glued to letters', 'xghp_' + A(36)],
    ['glued AKIA', 'fooAKIA' + A(16, 'A')],
    ['glued glpat', 'prefixglpat-' + A(20)],
    ['glued sk-ant', 'zsk-ant-api03-' + A(40)],
    ['glued xoxb', 'qxoxb-1234567890-abcdef'],
    ['CR only newline', 'x\r' + gh],
    ['LS newline', 'x\u2028' + gh]
  ])('finds %s', (_n, s) => expect(scanSecrets('f', s).length).toBeGreaterThan(0));
  it('does not treat a double backslash as an escape', () =>
    expect(scanSecrets('f', '\\\\x67hp_' + A(36))).toEqual([]));
  it('does not flag short or placeholder values', () => {
    expect(scanSecrets('f.md', 'password: "hunter2"')).toEqual([]);
    expect(scanSecrets('f.md', 'api_key=YOUR_API_KEY_HERE_PLEASE')).toEqual([]);
    expect(scanSecrets('f.md', 'token: <your token goes here>')).toEqual([]);
  });
});
