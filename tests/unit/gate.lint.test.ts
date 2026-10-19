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
    expect(rules('import "../other"')).toEqual([]); // relative path is not an import of a module name
  });
  it('declared use is a warning, undeclared is an error', () => {
    expect(rules('fetch("https://x")', { ...none, network: true })).toEqual(['xhr:warn']);
    expect(rules('fetch("https://x")')).toEqual(['xhr:error']);
  });
  it('flags very long lines', () => expect(rules('x'.repeat(401))).toContain('long-line:error'));
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
  it('never echoes the matched value', () => {
    const tok = 'ghp_' + 'Z'.repeat(36);
    expect(scanSecrets('f', tok).join()).not.toContain('ZZZZ');
  });
  it('is quiet on ordinary text', () =>
    expect(scanSecrets('f.md', 'Run `ow install` then open https://example.com/docs')).toEqual([]));
});
