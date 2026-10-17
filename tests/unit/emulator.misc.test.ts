import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_IDS } from '../../src/lib/themes/themes';
import { TOKEN_NAMES } from '../../src/lib/themes/types';
import { fuzzy, APPS } from '../../src/lib/emulator/apps';
import { EmulatorState } from '../../src/lib/emulator/state.svelte';
import { runCommand } from '../../src/lib/emulator/terminal';
import { wallpaper } from '../../src/lib/emulator/wallpaper';

describe('wallpaper', () => {
  it('is deterministic and differs between themes', () => {
    expect(wallpaper('nord')).toEqual(wallpaper('nord'));
    const sigs = new Set(THEME_IDS.map((id) => JSON.stringify(wallpaper(id))));
    expect(sigs.size).toBe(THEME_IDS.length);
  });
  it('uses theme tokens only', () => {
    const tokens = new Set(TOKEN_NAMES as readonly string[]);
    for (const id of THEME_IDS)
      for (const p of wallpaper(id)) {
        expect(tokens.has(p.token)).toBe(true);
        expect(p.opacity).toBeGreaterThan(0);
        expect(p.opacity).toBeLessThanOrEqual(1);
        expect(p.d).toMatch(/^[Mhvz0-9 .-]+$/);
      }
  });
});

describe('no colour literals in emulator source', () => {
  const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/;
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(svelte|ts)$/.test(f)) files.push(p);
    }
  };
  walk(join(__dirname, '../../src/lib/emulator'));
  walk(join(__dirname, '../../src/routes/emulator'));
  it('scans files', () => expect(files.length).toBeGreaterThan(15));
  for (const f of files)
    it(f.split('/src/')[1], () => {
      const bad = readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => literal.test(l));
      expect(bad).toEqual([]);
    });
});

describe('workspace state', () => {
  it('starts with 3 tiles on workspace 1 and 1 on workspace 2', () => {
    const e = new EmulatorState();
    expect([0, 1, 2, 3].map((i) => e.windowCount(i))).toEqual([3, 1, 0, 0]);
    expect(e.ws).toBe(0);
  });
  it('switches, cycles with wrap, and moves windows', () => {
    const e = new EmulatorState();
    e.goto(2);
    expect(e.ws).toBe(2);
    e.cycle(1);
    expect(e.ws).toBe(3);
    e.cycle(1);
    expect(e.ws).toBe(0);
    e.cycle(-1);
    expect(e.ws).toBe(3);
    e.goto(0);
    const id = e.focusedId!;
    e.moveTo(2);
    expect(e.ws).toBe(2);
    expect(e.windowCount(0)).toBe(2);
    expect(e.wsOf(id)).toBe(2);
  });
  it('opens and closes terminals, and leaves ghosts for the exit animation', () => {
    const e = new EmulatorState();
    e.open('terminal');
    expect(e.windowCount(0)).toBe(4);
    e.close();
    expect(e.windowCount(0)).toBe(3);
    expect(e.ghosts.length).toBe(1);
  });
  it('runs chords from the virtual keys with sticky Super', () => {
    const e = new EmulatorState();
    e.press('2', 'Digit2');
    expect(e.ws).toBe(0); // no modifier: nothing happens
    e.toggleMod('super');
    e.press('2', 'Digit2');
    expect(e.ws).toBe(1);
    expect(e.sticky).toEqual([]); // used up by one keystroke
  });
  it('Super+Alt+W opens the placeholder panel, Super+Alt+P is registered', () => {
    const e = new EmulatorState();
    e.run('widget-center');
    expect(e.panel).toBe('widgets');
    e.run('widget-peek');
    expect(e.peek).toBe(true);
    expect(e.closeOverlays()).toBe(true);
    expect(e.closeOverlays()).toBe(false);
  });
});

describe('apps and terminal', () => {
  it('fuzzy matches subsequences', () => {
    expect(fuzzy('trm', APPS)[0].id).toBe('terminal');
    expect(fuzzy('zzz', APPS)).toEqual([]);
  });
  it('terminal commands are labelled sample output', () => {
    for (const c of ['help', 'ow status', 'ow vault status'])
      expect((runCommand(c) as string[]).join('\n')).toContain('(sample output)');
    expect(runCommand('clear')).toBe('clear');
    expect((runCommand('rm -rf /') as string[])[0]).toContain('not found');
  });
});
