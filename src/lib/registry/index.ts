// Registry loader. Reads registry/dist/index.json, which `bun run registry` generates
// (it is not committed). `vite build` and `vite dev` bundle it through import.meta.glob, so
// SvelteKit prerendering sees it at build time and no registry request happens in the browser.
// The glob (instead of a static import) keeps `svelte-check` working before the file exists;
// a missing file fails loudly when a page actually needs the data.
import type { Category, RegistryIndex, RegistryWidget, Status, Tier } from './types';

export type * from './types';

const files = import.meta.glob<RegistryIndex>('../../../registry/dist/index.json', {
  eager: true,
  import: 'default'
});

function load(): RegistryIndex {
  const index = Object.values(files)[0];
  if (!index) throw new Error('registry/dist/index.json is missing: run `bun run registry` first');
  return index;
}

export function getIndex(): RegistryIndex {
  return load();
}

export function getAll(): RegistryWidget[] {
  return load().widgets;
}

export function getById(id: string): RegistryWidget | undefined {
  return load().widgets.find((w) => w.id === id);
}

export const categoryLabels: Record<Category, string> = {
  system: 'System',
  'time-calendar': 'Time and Calendar',
  productivity: 'Productivity',
  'dev-git': 'Dev and Git',
  'ai-agents': 'AI and Agents',
  media: 'Media',
  communication: 'Communication',
  'network-containers': 'Network and Containers',
  'ambient-fun': 'Ambient and Fun',
  utilities: 'Utilities'
};

export const statusLabels: Record<Status, string> = {
  planned: 'Planned, not installable yet',
  alpha: 'Alpha',
  stable: 'Stable'
};

// Tiers describe how much a human reviewed, never how isolated the code is.
export const tierLabels: Record<Tier, { label: string; text: string }> = {
  // Only for maintainer test fixtures. Real listings are never shown as this tier.
  concept: {
    label: 'Concept',
    text: 'A design idea, not installable. Nothing has been built or reviewed.'
  },
  spec: {
    label: 'Spec (reviewed)',
    text: 'A maintainer reviewed the pinned commit and confirmed it is a spec widget that runs no custom code. This is a review, not a sandbox.'
  },
  community: {
    label: 'Community',
    text: 'Not reviewed by a maintainer. It passed automated checks only. Read it before you install it.'
  },
  verified: {
    label: 'Verified',
    text: 'A maintainer read the pinned commit. This is a review, not a sandbox.'
  },
  core: {
    label: 'Core',
    text: 'Maintained by this project and reviewed at the pinned commit. This is a review, not a sandbox.'
  }
};

/** widget.json is written by the widget's author, so what it says about itself is not a tier. */
export function declaredTierNote(w: RegistryWidget): string | null {
  return w.tier === 'community' && w.declaredTier === 'spec'
    ? 'Declares itself spec, not reviewed'
    : null;
}
