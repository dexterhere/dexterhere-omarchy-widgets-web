import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crc32, zip } from '../../src/lib/make/zip';

const hasUnzip = (() => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('zip writer', () => {
  it('crc32 of "123456789" is the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes a readable archive: signatures, sizes, names and bytes', () => {
    const files = [
      { name: 'manifest.json', text: '{"a":1}\n' },
      { name: 'README.md', text: '# Héllo ☃\n' },
      { name: 'empty.txt', text: '' }
    ];
    const z = zip(files);
    const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
    const end = z.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(3);
    let at = v.getUint32(end + 16, true); // central directory
    const td = new TextDecoder();
    for (const f of files) {
      expect(v.getUint32(at, true)).toBe(0x02014b50);
      const size = v.getUint32(at + 24, true);
      const nameLen = v.getUint16(at + 28, true);
      const off = v.getUint32(at + 42, true);
      expect(td.decode(z.subarray(at + 46, at + 46 + nameLen))).toBe(f.name);
      expect(v.getUint32(off, true)).toBe(0x04034b50);
      const data = z.subarray(off + 30 + nameLen, off + 30 + nameLen + size);
      expect(td.decode(data)).toBe(f.text);
      expect(v.getUint32(at + 16, true)).toBe(crc32(data));
      at += 46 + nameLen;
    }
    expect(at).toBe(end);
  });

  it('is the same bytes every time', () => {
    const f = [{ name: 'a', text: 'b' }];
    expect(zip(f)).toEqual(zip(f));
  });

  it.skipIf(!hasUnzip)('is accepted by unzip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    const file = join(dir, 'x.zip');
    writeFileSync(
      file,
      zip([
        { name: 'LICENSE', text: 'MIT\n' },
        { name: 'a/b.txt', text: 'hi' }
      ])
    );
    expect(execFileSync('unzip', ['-t', file]).toString()).toContain('No errors detected');
    execFileSync('unzip', ['-q', file, '-d', join(dir, 'out')]);
    expect(readFileSync(join(dir, 'out', 'LICENSE'), 'utf8')).toBe('MIT\n');
  });
});
