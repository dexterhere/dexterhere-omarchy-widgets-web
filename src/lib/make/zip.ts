// A store-only (no compression) zip writer, so "Download all" needs no library.
// Format: local header + name + data per file, then the central directory and the end record.
const te = new TextEncoder();

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) c = TABLE[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** files: name (plain ASCII path, no leading slash) and text. Fixed 1980-01-01 time, so output is stable. */
export function zip(files: { name: string; text: string }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: DataView, o: number, n: number) => v.setUint16(o, n, true);
  const u32 = (v: DataView, o: number, n: number) => v.setUint32(o, n, true);
  for (const f of files) {
    const name = te.encode(f.name);
    const data = te.encode(f.text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    u32(local, 0, 0x04034b50);
    u16(local, 4, 20); // version needed
    u16(local, 6, 0x0800); // flags: UTF-8 names
    u16(local, 8, 0); // method 0: stored
    u16(local, 12, 0x0021); // date 1980-01-01 (time 0)
    u32(local, 14, crc);
    u32(local, 18, data.length);
    u32(local, 22, data.length);
    u16(local, 26, name.length);
    parts.push(new Uint8Array(local.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    u32(c, 0, 0x02014b50);
    u16(c, 4, 20);
    u16(c, 6, 20);
    u16(c, 8, 0x0800);
    u16(c, 14, 0x0021);
    u32(c, 16, crc);
    u32(c, 20, data.length);
    u32(c, 24, data.length);
    u16(c, 28, name.length);
    u32(c, 42, offset);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  u32(end, 0, 0x06054b50);
  u16(end, 8, files.length);
  u16(end, 10, files.length);
  u32(end, 12, size);
  u32(end, 16, offset);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
