// Types the host page and later steps (the widget layer, Widget Center) plug into.
import type { Snippet } from 'svelte';
import type { EmulatorState } from './state.svelte';
import type { Binding } from './keys';
import type { SpecDoc } from '../builder/spec';
import type { WidgetType } from '../desktop/layout';

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
  /**
   * Layer "Top": drawn above the windows and below the bar and panels (peek, edit mode, widgets
   * on the Top layer). Pointer events are off by default.
   */
  liftedLayer?: Snippet<[EmulatorApi]>;
  /** Drawn above the windows and panels (edit toolbar, inspector). */
  overlayLayer?: Snippet<[EmulatorApi]>;
  /** Replaces the "coming in the next step" placeholder in the Widget Center panel. */
  widgetCenter?: Snippet<[EmulatorApi]>;
  barItems?: ExtraBarItem[];
  menuRows?: ExtraMenuRow[];
  onapi?: (api: EmulatorApi) => void;
  /** Compact inline size: a wide, short desktop (used on widget detail pages). */
  compact?: boolean;
  /** Start on this workspace (1 to 4). Workspace 3 is empty, so widgets show on the wallpaper. */
  workspace?: number;
  /** Large stage on the home page: fills a tall frame, legend closed. */
  stage?: boolean;
  /** False starts with no windows open (the wallpaper and widgets show; Reset keeps it so). */
  windows?: boolean;
  /** Show a one-time hint on the Widgets bar item until the first interaction (memory only). */
  coach?: boolean;
}

/** A widget to place at start: a registry id or a type name, with an optional position. */
export type InitialWidget =
  | string
  | {
      id: string;
      /** Model pixels on the 1280 by 720 reference desktop; omitted = first free slot. */
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      variant?: string;
      layer?: 'background' | 'bottom' | 'top';
      /** Corner and offsets (model pixels) instead of x and y: survives a wider desktop. */
      anchor?: 'tl' | 'tr' | 'bl' | 'br';
      ox?: number;
      oy?: number;
    };

/** What a host page can do with the widget layer once the emulator is ready. */
export interface WidgetsApi {
  /** Install (a preview, for concepts) a registry widget and place it at the first free slot. */
  install: (reg: string) => void;
  /** Place a draft spec widget from the builder. In memory only. Returns false when not ready. */
  /** Enter or leave edit mode (selects the first widget so it can be dragged). */
  edit: (on: boolean) => void;
  placeSpec: (spec: SpecDoc, size: { w: number; h: number; type: WidgetType }) => boolean;
}

/** Props of the widget-enabled emulator (what pages embed through LazyEmulator). */
export interface WidgetEmulatorProps extends EmulatorProps {
  /** Widgets on the desktop at start. Omitted = the starter layout. */
  initialWidgets?: InitialWidget[];
  /** Open the Widget Center (and edit mode) at start. */
  openCenter?: boolean;
  /** Registry id (or instance id) of the widget to select at start. */
  selectedWidgetId?: string;
  /** Called once the widget layer is ready (after the desktop has a size). */
  onwidgets?: (w: WidgetsApi) => void;
}
