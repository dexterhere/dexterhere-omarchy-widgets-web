import { buildRegistry } from '../../scripts/build-registry';
import { newDraft, type Draft } from '../../src/lib/make/draft';
import { buildFiles, type Files } from '../../src/lib/make/files';
import { listingOf } from '../../src/lib/make/publish';
import { runChecks } from '../../src/lib/make/check';
import type { TemplateId } from '../../src/lib/make/templates';

export const draftOf = (template: TemplateId, over: Partial<Draft> = {}): Draft =>
  newDraft(template, {
    name: 'Night Clock',
    description: 'A clock for the dark.',
    user: 'Someone',
    ...over
  });

export const checkOf = (d: Draft, f: Files = buildFiles(d, 2026)) =>
  runChecks({
    manifest: f.manifest,
    widget: f.widget,
    layout: f.layout,
    listing: listingOf(d, '0'.repeat(40))
  });

/** The docs' check-local helper: the real registry build over the files, offline, no network. */
export async function registryBuild(d: Draft, f: Files = buildFiles(d, 2026)) {
  const files: Record<string, unknown> = {
    manifest: JSON.parse(f.manifest),
    widget: JSON.parse(f.widget),
    layout: JSON.parse(f.layout)
  };
  const id = JSON.parse(f.manifest).id as string;
  return buildRegistry({
    listings: [
      {
        file: `${id}.json`,
        data: { ...listingOf(d, '0'.repeat(40)), source: 'fixture' }
      }
    ],
    offline: true,
    skipReachability: true,
    lock: {},
    readFixture: (_id, n) => files[n],
    readReview: () => undefined
  });
}
