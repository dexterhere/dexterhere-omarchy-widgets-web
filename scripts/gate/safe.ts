// Author-controlled text (paths, hosts, names) ends up in build logs and index.json. CI log lines
// that start with `::` are GitHub Actions workflow commands, so no message may carry `::` or a
// line break from author text. Use for every string that originates in a widget repo.
export function safe(s: string, max = 120): string {
  const t = String(s)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, '?')
    .replace(/:{2,}/g, ':?');
  return t.length > max ? t.slice(0, max) + '\u2026' : t;
}
