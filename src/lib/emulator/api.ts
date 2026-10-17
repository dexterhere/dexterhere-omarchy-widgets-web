// Types the host page and later steps (the widget layer, Widget Center) plug into.
import type { Snippet } from 'svelte';
import type { EmulatorState } from './state.svelte';
import type { Binding } from './keys';

export interface ExtraBarItem {
  id: string;
  label: string;
  /** An icon name known to Icon.svelte. */
  icon: string;
  onclick: () => void;
}
export interface ExtraMenuRow {
  id: string;
  label: string;
  proposed?: boolean;
  onclick: () => void;
}

/** What the emulator hands to snippets and to the `onapi` callback. */
export interface EmulatorApi {
  state: EmulatorState;
  /** Say something to screen readers (polite live region). */
  announce: (msg: string) => void;
  /** Register a keybinding. Throws when the chord is taken. Returns an unregister function. */
  addBinding: (b: Binding) => () => void;
  openWidgetCenter: () => void;
  closeWidgetCenter: () => void;
}

export interface EmulatorProps {
  /** Called for "Style" in the Omarchy menu and for Super+Ctrl+Shift+Space. */
  onPickTheme?: () => void;
  /** Theme id for the wallpaper variant. Defaults to the site's current theme. */
  themeId?: string;
  /**
   * Layer "Bottom": drawn between the wallpaper and the windows (pointer-events none by default).
   */
  widgetLayer?: Snippet<[EmulatorApi]>;
  /** Drawn above the windows and panels (edit mode, sheets). */
  overlayLayer?: Snippet<[EmulatorApi]>;
  /** Replaces the "coming in the next step" placeholder in the Widget Center panel. */
  widgetCenter?: Snippet<[EmulatorApi]>;
  barItems?: ExtraBarItem[];
  menuRows?: ExtraMenuRow[];
  onapi?: (api: EmulatorApi) => void;
}
