// Gate G5 (provider cross-check): a widget may only use providers, topics and fields that exist in
// registry/providers.json, with the auth the catalog says. Returns the catalog classes in use.
export interface Catalog {
  schemaVersion: number;
  /** Per provider: `topic.field` pairs the shipped daemon serves today (the rest is planned). */
  providers: Record<
    string,
    {
      class: string;
      auth: 'none' | 'vault';
      egress: string[];
      topics: Record<string, string[]>;
      serving?: string[];
    }
  >;
}
export interface WidgetProviders {
  providers: { name: string; topics: string[]; fields: string[]; auth?: string }[];
}

const has = (o: object, k: string) => Object.hasOwn(o, k);

export function checkProviders(
  w: WidgetProviders,
  cat: Catalog
): { problems: string[]; classes: string[] } {
  const problems: string[] = [];
  const classes = new Set<string>();
  for (const p of w.providers) {
    if (!has(cat.providers, p.name)) {
      problems.push(`provider ${p.name}: not in the catalog (only first-party providers exist)`);
      continue;
    }
    const c = cat.providers[p.name];
    classes.add(c.class);
    if (p.auth !== undefined && p.auth !== c.auth)
      problems.push(`provider ${p.name}: auth is ${c.auth} in the catalog, not ${p.auth}`);
    const known = new Set<string>();
    for (const t of p.topics) {
      if (!has(c.topics, t)) problems.push(`provider ${p.name}: unknown topic ${t}`);
      else c.topics[t].forEach((f) => known.add(f));
    }
    for (const f of p.fields)
      if (!known.has(f))
        problems.push(`provider ${p.name}: field ${f} is not offered by its topics`);
  }
  return { problems, classes: [...classes].sort() };
}
