// WCAG 2.1.4 (Character Key Shortcuts): the site's single-key shortcuts (T opens the theme picker,
// / focuses a search) can be turned off. Default ON (Omarchy parity). Modifier shortcuts such as
// Ctrl+K are not single-key and stay. One capture-phase guard on the window (installed by the
// footer, which is on every page) swallows the bare keys, so every consumer honours the setting
// without knowing about it.

export const SINGLE_KEYS_STORAGE = 'ow-single-keys';

/** A bare T, t or / pressed outside a text field and outside the emulator. */
export function isSingleKey(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.key !== '/' && e.key !== 't' && e.key !== 'T') return false;
  const t = e.target;
  if (typeof HTMLElement === 'undefined' || !(t instanceof HTMLElement)) return true;
  if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return false;
  return !t.closest('[data-emulator]'); // the emulator has its own keyboard capture
}

class SingleKeyShortcuts {
  on = $state(true);

  /** Call once on the client. Storage may be blocked: then the default (on) holds. */
  init() {
    try {
      this.on = localStorage.getItem(SINGLE_KEYS_STORAGE) !== 'off';
    } catch {
      /* blocked */
    }
  }
  set(on: boolean) {
    this.on = on;
    try {
      localStorage.setItem(SINGLE_KEYS_STORAGE, on ? 'on' : 'off');
    } catch {
      /* blocked: lasts for this page view */
    }
  }
  /** Window keydown in the capture phase. */
  guard = (e: KeyboardEvent) => {
    if (!this.on && isSingleKey(e)) e.stopImmediatePropagation();
  };
}

export const shortcuts = new SingleKeyShortcuts();
