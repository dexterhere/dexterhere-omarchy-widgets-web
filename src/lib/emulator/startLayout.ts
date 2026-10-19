import type { InitialWidget } from './api';

// Four widgets on an empty workspace: the wallpaper shows and the widgets are the point.
// Two tidy columns of one width (288) with 24 px gaps, drawn 1.3 times larger by `zoom`.
// Shared by the home stage and the theme picker's live preview.
export const START_ZOOM = 1.3;
export const START_WIDGETS: InitialWidget[] = [
  { id: 'github', anchor: 'tl', ox: 32, oy: 32, w: 288, h: 176 },
  { id: 'battery', anchor: 'tl', ox: 32, oy: 232, w: 288, h: 112 },
  { id: 'clock', anchor: 'tr', ox: 32, oy: 56, w: 288, h: 120, variant: 'digital' },
  { id: 'system', anchor: 'tr', ox: 32, oy: 200, w: 288, h: 168 }
];
