// The files a widget repository needs, written from a draft. Pure: the year is passed in.
import { fieldOf, type LicenseId } from './catalog';
import { allBinds } from './edit';
import { descOf, idOf, nameOf, repoOf, userOf, type Draft } from './draft';
import { TEMPLATES } from './templates';

export const VERSION = '0.1.0';
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';

export function manifestJson(d: Draft) {
  return {
    id: idOf(d),
    name: nameOf(d),
    version: VERSION,
    description: descOf(d),
    license: d.license
  };
}

/** providers and sampleData come from what the layout reads, so they can never disagree with it. */
export function widgetJson(d: Draft) {
  const byProvider = new Map<string, { topics: Set<string>; fields: Set<string>; auth: string }>();
  const sampleData: Record<string, Record<string, number | string | string[]>> = {};
  for (const b of allBinds(d.layout)) {
    const f = fieldOf(b.topic, b.field);
    if (!f) continue;
    const p = byProvider.get(f.provider) ?? { topics: new Set(), fields: new Set(), auth: f.auth };
    p.topics.add(f.topic);
    p.fields.add(f.field);
    byProvider.set(f.provider, p);
    (sampleData[f.topic] ??= {})[f.field] = f.sample;
  }
  const t = TEMPLATES[d.template];
  return {
    schemaVersion: 0,
    id: idOf(d),
    tier: 'spec',
    category: d.category,
    surfaces: t.surfaces,
    sizeClasses: t.sizeClasses,
    variants: Object.keys(d.layout.variants ?? {}),
    providers: [...byProvider].map(([name, p]) => ({
      name,
      topics: [...p.topics].sort(),
      fields: [...p.fields].sort(),
      auth: p.auth
    })),
    capabilities: { network: [], files: [], spawn: [] },
    interactiveRegions: [],
    settings: [],
    compat: { omarchy: '>=4.0', widgetsKit: '^1' },
    sampleData
  };
}

export const layoutJson = (d: Draft) => d.layout;

const esc = (s: string) => s.replace(/([\\`*_{}[\]()#+!|<>~])/g, '\\$1');

export function readme(d: Draft): string {
  const reads = [...new Set(allBinds(d.layout).map((b) => `${b.topic} / ${b.field}`))];
  return `# ${esc(nameOf(d))}

${esc(descOf(d))}

A spec widget for Omarchy Widgets: JSON files only, no code. Id: \`${idOf(d)}\`.

## What it reads

${reads.length ? reads.map((r) => `- \`${r}\``).join('\n') : '- Nothing.'}

It uses no network, no files and no programs.

## Install

Not available yet. Omarchy Widgets is pre-release and the desktop layer that runs widgets has not shipped, so this widget is listed as Planned. When installing exists, the registry page for \`${idOf(d)}\` will say how.

## Remove

Nothing to remove yet.

## Preview

Open the widget page on the Omarchy Widgets site to see it drawn with sample data.

## License

${d.license}. See [LICENSE](LICENSE).
`;
}

/* ---------------------------------- LICENSE ---------------------------------- */

const MIT = (who: string, year: number) => `MIT License

Copyright (c) ${year} ${who}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const ISC = (who: string, year: number) => `ISC License

Copyright (c) ${year} ${who}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
`;

const BSD_HEAD = (who: string, year: number) => `Copyright (c) ${year}, ${who}
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
`;
const BSD_TAIL = `
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
`;
const BSD2 = (who: string, year: number) =>
  `BSD 2-Clause License\n\n${BSD_HEAD(who, year)}${BSD_TAIL}`;
const BSD3 = (who: string, year: number) =>
  `BSD 3-Clause License\n\n${BSD_HEAD(who, year)}
3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.
${BSD_TAIL}`;

const ZERO_BSD = (who: string, year: number) => `BSD Zero Clause License

Copyright (c) ${year} ${who}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
`;

const UNLICENSE = `This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>
`;

/** The long licenses are not retyped here: GitHub only recognises the official text, so the
 *  person downloads it. These are the official sources. */
const OFFICIAL: Partial<Record<LicenseId, string>> = {
  'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0.txt',
  'MPL-2.0': 'https://www.mozilla.org/media/MPL/2.0/index.txt',
  'GPL-3.0': 'https://www.gnu.org/licenses/gpl-3.0.txt',
  'LGPL-3.0': 'https://www.gnu.org/licenses/lgpl-3.0.txt',
  'AGPL-3.0': 'https://www.gnu.org/licenses/agpl-3.0.txt'
};

export type LicenseFile =
  { kind: 'text'; text: string } | { kind: 'fetch'; url: string; command: string };

export function licenseFile(d: Draft, year: number): LicenseFile {
  const who = d.holder.replace(/\s+/g, ' ').trim() || userOf(d);
  const url = OFFICIAL[d.license];
  if (url) return { kind: 'fetch', url, command: `curl -fsSL ${url} -o LICENSE` };
  const make: Record<string, (w: string, y: number) => string> = {
    MIT,
    ISC,
    'BSD-2-Clause': BSD2,
    'BSD-3-Clause': BSD3,
    '0BSD': ZERO_BSD,
    Unlicense: () => UNLICENSE
  };
  return { kind: 'text', text: make[d.license](who, year) };
}

export interface Files {
  manifest: string;
  widget: string;
  layout: string;
  readme: string;
  license: LicenseFile;
}

export function buildFiles(d: Draft, year = new Date().getFullYear()): Files {
  return {
    manifest: json(manifestJson(d)),
    widget: json(widgetJson(d)),
    layout: json(layoutJson(d)),
    readme: readme(d),
    license: licenseFile(d, year)
  };
}

/** File name and text of everything that can be saved as a file. */
export function fileList(d: Draft, year?: number): { name: string; text: string }[] {
  const f = buildFiles(d, year);
  return [
    { name: 'manifest.json', text: f.manifest },
    { name: 'widget.json', text: f.widget },
    { name: 'layout.json', text: f.layout },
    ...(f.license.kind === 'text' ? [{ name: 'LICENSE', text: f.license.text }] : []),
    { name: 'README.md', text: f.readme }
  ];
}

export const zipName = (d: Draft) => `${repoOf(d)}.zip`;
