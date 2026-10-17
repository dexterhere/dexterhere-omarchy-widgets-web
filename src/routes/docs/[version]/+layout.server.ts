import { error } from '@sveltejs/kit';
import pinned from '../../../../registry/schema/PINNED.json';
import { latest, sidebarFor, versions } from '../../../lib/docs/loader.server';

export const load = ({ params }) => {
  const version = versions.find((v) => v.version === params.version);
  if (!version) error(404, 'Unknown docs version');
  return {
    version,
    versions,
    latest: latest.version,
    sidebar: sidebarFor(version.version),
    pagesByVersion: Object.fromEntries(
      versions.map((v) => [
        v.version,
        sidebarFor(v.version).flatMap((s) => s.pages.map((p) => p.slug))
      ])
    ),
    schemaVersion: pinned.version
  };
};
