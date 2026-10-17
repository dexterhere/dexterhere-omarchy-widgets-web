import pinned from '../../registry/schema/PINNED.json';
import { shortCommit } from '../lib/footer';
import { latest } from '../lib/docs/loader.server';

// Build info for the footer, read at prerender time. Nothing is fetched in the browser.
export const load = () => ({
  footer: {
    docsVersion: latest.version,
    docsLabel: latest.label,
    schema: pinned.version,
    commit: shortCommit(typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : '')
  }
});
