import { DEFAULT_DARK, STORAGE_KEY, THEME_IDS } from './themes';

const HINT_KEY = 'ow-theme-hint';

// All storage access is wrapped: the site must work with storage blocked.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice simply lasts for this page view */
  }
}

/** Colours (only) ease for a moment while the theme changes; the class is removed right after. */
function crossfade() {
  const root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('theme-fade');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => root.classList.remove('theme-fade'), 200);
}
let fadeTimer: ReturnType<typeof setTimeout>;

class ThemeState {
  /** The theme currently applied to the page. */
  current = $state(DEFAULT_DARK);
  open = $state(false);
  hintVisible = $state(false);

  /** Call once on the client. theme-boot.js has already set data-theme before first paint. */
  init() {
    const attr = document.documentElement.dataset.theme ?? '';
    this.current = THEME_IDS.includes(attr) ? attr : DEFAULT_DARK;
    this.hintVisible = read(HINT_KEY) !== '1';
  }

  /** Apply to the page without remembering it (live preview). */
  apply(id: string) {
    if (!THEME_IDS.includes(id)) return;
    this.current = id;
    crossfade();
    document.documentElement.dataset.theme = id;
    // Tab icon and theme-color (defined by static/theme-boot.js; absent in tests that skip it).
    (window as { __owIcon?: (id: string) => void }).__owIcon?.(id);
  }

  /** Apply and remember. */
  keep(id: string) {
    this.apply(id);
    write(STORAGE_KEY, id);
  }

  /** Element that had focus when the picker opened; focus goes back there on close. */
  opener: HTMLElement | null = null;

  openPicker() {
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.open = true;
    this.dismissHint();
  }

  dismissHint() {
    this.hintVisible = false;
    if (typeof document !== 'undefined') document.documentElement.removeAttribute('data-hint');
    write(HINT_KEY, '1');
  }
}

export const theme = new ThemeState();
