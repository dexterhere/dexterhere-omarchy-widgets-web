<script lang="ts">
  import Seo from '../../../lib/components/Seo.svelte';
  import { breadcrumbs } from '../../../lib/seo';
  import { docsUrl, urls } from '../../../lib/site';
  import { resolve } from '$app/paths';
  import CopyButton from '../../../lib/components/CopyButton.svelte';
  import Ico from '../../../lib/components/detail/Ico.svelte';
  import WidgetPreview from '../../../lib/components/gallery/WidgetPreview.svelte';
  import StatsRow from '../../../lib/components/stats/StatsRow.svelte';
  import { SIZE_CLASSES, fitToClass, snap, type SizeClass } from '../../../lib/desktop/layout';
  import {
    categoryLabels,
    declaredTierNote,
    statusLabels,
    tierLabels
  } from '../../../lib/registry';
  import { REPORT_URL, safeRepoUrl, shortCommit } from '../../../lib/registry/links';
  import { CARD_SIZE, previewType } from '../../../lib/registry/preview';
  import LayoutView from '../../../lib/components/widgets/LayoutView.svelte';
  import LazyEmulator from '../../../lib/emulator/LazyEmulator.svelte';
  import { theme } from '../../../lib/themes/store.svelte';

  let { data } = $props();
  const w = $derived(data.widget);

  const type = $derived(previewType(w.id));
  const classes = $derived(
    type ? (Object.keys(SIZE_CLASSES[type]) as SizeClass[]) : ([] as SizeClass[])
  );
  const repo = $derived(safeRepoUrl(w.repo));
  const short = $derived(shortCommit(w.commit));
  const note = $derived(declaredTierNote(w));
  const cats = $derived(w.categories.map((c) => categoryLabels[c]).join(', '));

  // Preview state. Re-seeded when the widget changes (client navigation between details).
  let cls = $state<SizeClass>('compact');
  let pw = $state(0);
  let ph = $state(0);
  let variant = $state('');
  $effect(() => {
    if (!type) return;
    const c = classes.includes('wide') ? 'wide' : classes[0];
    cls = c;
    const def = CARD_SIZE[type];
    const f = fitToClass(SIZE_CLASSES[type][c]!, def.w, def.h);
    pw = snap(f.w);
    ph = snap(f.h);
    variant = w.variants[0] ?? 'default';
  });
  const spec = $derived(type ? SIZE_CLASSES[type][cls] : undefined);

  function pick(c: SizeClass) {
    if (!type) return;
    const s = SIZE_CLASSES[type][c]!;
    const f = fitToClass(s, pw, ph);
    cls = c;
    pw = Math.min(s.maxW, Math.max(s.minW, snap(f.w)));
    ph = Math.min(s.maxH, Math.max(s.minH, snap(f.h)));
  }

  // The only documented install path. It takes the latest commit, not the listed one.
  const manualCmd = $derived(repo ? `omarchy plugin add ${repo}` : '');
  const commitUrl = $derived(repo && short ? `${repo}/tree/${w.commit}` : '');
  // Per-widget setup notes. Nothing here is a command: the install path does not exist yet.
  const setupNote: Record<string, string> = {
    'io.github.dexterhere.github-activity':
      'It will need a GitHub token kept in the vault. The widget never sees the token.'
  };

  const accessRows = $derived([
    { label: 'Data', icon: 'database', items: w.access.data },
    { label: 'Network', icon: 'globe', items: w.access.network },
    { label: 'Files', icon: 'file', items: w.access.files },
    { label: 'Runs programs', icon: 'terminal', items: w.access.programs },
    { label: 'Secrets', icon: 'key', items: w.access.secrets }
  ]);

  const limits = (s: (typeof w.settings)[number]) =>
    s.options?.length
      ? `one of ${s.options.join(', ')}`
      : s.min !== undefined || s.max !== undefined
        ? `${s.min ?? 'any'} to ${s.max ?? 'any'}`
        : 'none';
</script>

<Seo
  title={w.name}
  description={w.summary}
  path={`/widgets/${encodeURIComponent(w.id)}/`}
  type="article"
  nodes={[
    {
      '@type': 'SoftwareSourceCode',
      name: w.name,
      description: w.summary,
      url: urls.site(`/widgets/${encodeURIComponent(w.id)}/`),
      ...(repo ? { codeRepository: repo } : {})
    },
    breadcrumbs([
      { name: 'Omarchy Widgets', url: urls.site('/') },
      { name: 'Widgets', url: urls.site('/widgets/') },
      { name: w.name, url: urls.site(`/widgets/${encodeURIComponent(w.id)}/`) }
    ])
  ]}
/>

<div class="site-frame page">
  <nav class="crumbs small" aria-label="Breadcrumb">
    <a href={resolve('/widgets')}>Widgets</a>
    <span aria-hidden="true">/</span>
    <span aria-current="page">{w.name}</span>
  </nav>

  <header class="head">
    <h1>{w.name}</h1>
    <p class="lede text-2">{w.summary}</p>
    <ul class="chips" aria-label="Status, tier and category">
      <li class="chip" data-status={w.status}>
        <Ico name="status" size={14} />{statusLabels[w.status]}
      </li>
      <li class="chip" data-tier={w.tier}>
        <Ico name={w.tier} size={14} />Tier: {tierLabels[w.tier].label}
      </li>
      <li class="chip"><Ico name="spec" size={14} />{cats}</li>
    </ul>
    <div class="actions">
      <a class="btn-primary" href="#try"><Ico name="play" size={14} />Try in emulator</a>
      {#if repo}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a class="btn" href={repo} rel="noopener noreferrer"
          ><Ico name="code" size={14} />View source</a
        >
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a class="btn" href="{repo}#readme" rel="noopener noreferrer"
          ><Ico name="book" size={14} />README</a
        >
      {/if}
    </div>
    <!-- Opening this page records one view (once a day, never when DNT or GPC is on). -->
    {#key w.id}<StatsRow id={w.id} name={w.name} repo={w.repo} view />{/key}
  </header>

  <div class="top">
    <section class="block preview" aria-labelledby="h-preview">
      <h2 id="h-preview">Preview</h2>
      <div class="pstage" data-testid="detail-preview">
        <WidgetPreview widget={w} w={type ? pw : undefined} h={type ? ph : undefined} {variant} />
      </div>
      {#if type && spec}
        <div class="controls">
          <div class="ctl" role="group" aria-label="Size class">
            <span class="label small">Size class</span>
            <div class="seg">
              {#each classes as c (c)}
                <button type="button" aria-pressed={cls === c} onclick={() => pick(c)}>{c}</button>
              {/each}
            </div>
          </div>
          {#if w.variants.length}
            <div class="ctl" role="group" aria-label="Variant">
              <span class="label small">Variant</span>
              <div class="seg">
                {#each w.variants as v (v)}
                  <button type="button" aria-pressed={variant === v} onclick={() => (variant = v)}
                    >{v}</button
                  >
                {/each}
              </div>
            </div>
          {/if}
          <fieldset class="ctl resize">
            <legend class="label small"><Ico name="resize" size={14} />Resize</legend>
            <div class="rs">
              <label class="small" for="pw">
                <span>Width</span> <span class="num">{pw}px</span>
                <span class="muted">({spec.minW} to {spec.maxW})</span>
              </label>
              <input
                id="pw"
                type="range"
                min={spec.minW}
                max={spec.maxW}
                step="8"
                bind:value={pw}
              />
            </div>
            <div class="rs">
              <label class="small" for="ph">
                <span>Height</span> <span class="num">{ph}px</span>
                <span class="muted">({spec.minH} to {spec.maxH})</span>
              </label>
              <input
                id="ph"
                type="range"
                min={spec.minH}
                max={spec.maxH}
                step="8"
                bind:value={ph}
              />
            </div>
          </fieldset>
        </div>
        <p class="tiny muted">
          Sample data, not your machine. The preview follows the page theme: press <kbd>T</kbd> to change
          it. The preview above is one fixed illustration; the layout drawn below follows the variant
          you pick.
        </p>
      {:else}
        <p class="tiny muted">
          Sample data generated from the listing, not your machine. Size and variant controls need a
          dedicated preview, which this widget does not have yet.
        </p>
      {/if}
    </section>

    <aside class="side" aria-label="Install, access and trust">
      <section class="block" aria-labelledby="h-install">
        <h2 id="h-install"><Ico name="terminal" size={16} />Install</h2>
        {#if !w.installable || !manualCmd}
          <p><strong>Not installable yet.</strong></p>
          <p class="small text-2">
            Status: {statusLabels[w.status]}. You can try a preview in the web emulator below. There
            is no install command yet, because the desktop layer and <code>ow install</code> are not
            built. {setupNote[w.id] ?? ''}
            {#if setupNote[w.id]}<!-- eslint-disable-next-line svelte/no-navigation-without-resolve --><a
                href={docsUrl('/docs/next/project/security/')}>Security docs</a
              >.{/if}
          </p>
          {#if repo}
            <p class="small">
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={repo} rel="noopener noreferrer"
                >Read the code on GitHub <Ico name="external" size={12} /></a
              >
            </p>
          {/if}
        {:else}
          <p class="small text-2">
            Documented way to add it. This installs the latest commit of the repository, not the
            listed one, so compare the commit you get with the one under Details before you trust
            it.
          </p>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <pre tabindex="0"><code>{manualCmd}</code></pre>
          <CopyButton text={manualCmd} label="Copy install command" />
        {/if}
      </section>

      <section class="block" aria-labelledby="h-access">
        <h2 id="h-access"><Ico name="alert" size={16} />What it can access</h2>
        <p class="small text-2">Generated from the widget&rsquo;s own files, not hand-written.</p>
        <dl class="access">
          {#each accessRows as row (row.label)}
            {@const none = row.items.length === 0}
            <div>
              <dt><Ico name={row.icon} size={14} />{row.label}</dt>
              <dd>
                <ul>
                  {#each none ? ['none'] : row.items as item, i (i)}<li class:none>
                      {item}
                    </li>{/each}
                </ul>
              </dd>
            </div>
          {/each}
        </dl>
      </section>

      <section class="block" aria-labelledby="h-trust">
        <h2 id="h-trust"><Ico name={w.tier} size={16} />Trust</h2>
        <p><strong>{tierLabels[w.tier].label}.</strong> {tierLabels[w.tier].text}</p>
        {#if w.tier === 'community'}
          <p class="warn small">
            Unreviewed code, not sandboxed. If you install it, it runs with the access of your user
            account. Read the source first.
          </p>
        {/if}
        {#if note}<p class="small">{note}.</p>{/if}
        {#if w.review}
          <dl class="dl small">
            <div>
              <dt>Reviewed by</dt>
              <dd>{w.review.reviewer}</dd>
            </div>
            <div>
              <dt>Review date</dt>
              <dd>{w.review.date}</dd>
            </div>
            <div>
              <dt>Reviewed commit</dt>
              <dd><code>{shortCommit(w.review.reviewedCommit) || 'unknown'}</code></dd>
            </div>
          </dl>
        {:else if w.reviewNote}
          <p class="small text-2">{w.reviewNote}</p>
        {/if}
      </section>
    </aside>
  </div>

  <section class="block" aria-labelledby="h-try" id="try" data-try-desktop>
    <h2 id="h-try"><Ico name="play" size={16} />Try it on a desktop</h2>
    <p class="small text-2">
      Emulated desktop, sample data. {w.installable
        ? ''
        : 'This is a preview of a planned widget. '}Press Super + Alt + W (proposed) or click
      Widgets in the bar to open the Widget Center.
    </p>
    <div class="try">
      {#key w.id}
        <LazyEmulator
          compact
          initialWidgets={[w.id]}
          selectedWidgetId={w.id}
          workspace={3}
          onPickTheme={() => theme.openPicker()}
        />
      {/key}
    </div>
  </section>

  <div class="two">
    <div class="col">
      <section class="block" aria-labelledby="h-about">
        <h2 id="h-about">About</h2>
        <p class="about">{w.description}</p>
      </section>

      <section class="block" aria-labelledby="h-settings">
        <h2 id="h-settings">Settings</h2>
        {#if w.settings.length}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div class="scroll" role="region" aria-label="Settings table" tabindex="0">
            <table class="small">
              <thead>
                <tr
                  ><th scope="col">Setting</th><th scope="col">Type</th><th scope="col">Default</th
                  ><th scope="col">Limits</th></tr
                >
              </thead>
              <tbody>
                {#each w.settings as s (s.key)}
                  <tr>
                    <th scope="row">{s.label ?? s.key}<br /><code>{s.key}</code></th>
                    <td>{s.type}</td>
                    <td>{String(s.default)}</td>
                    <td>{limits(s)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="small text-2">No settings.</p>
        {/if}
      </section>
    </div>

    <section class="block" aria-labelledby="h-details">
      <h2 id="h-details">Details</h2>
      <dl class="dl small">
        <div>
          <dt>Version</dt>
          <dd>{w.version}</dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>{w.license}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{cats}</dd>
        </div>
        <div>
          <dt>Listed commit</dt>
          <dd>
            {#if commitUrl}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={commitUrl} rel="noopener noreferrer"
                ><code title={w.commit}>{short}</code><Ico name="external" size={12} /></a
              >
            {:else if short}<code title={w.commit}>{short}</code>
            {:else}<span class="muted">none</span>{/if}
          </dd>
        </div>
        <div>
          <dt>Repository</dt>
          <dd>
            {#if repo}<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={repo} rel="noopener noreferrer">{repo.replace('https://', '')}</a>
            {:else}<span class="muted">No valid repository link</span>{/if}
          </dd>
        </div>
        <div>
          <dt>Size classes</dt>
          <dd>
            {#each w.sizeClasses as s (s.name)}
              <div>
                {s.name}: {s.min[0]} by {s.min[1]} up to {s.max[0]} by {s.max[1]}
              </div>
            {:else}<span class="muted">none listed</span>{/each}
          </dd>
        </div>
        <div>
          <dt>Variants</dt>
          <dd>{w.variants.join(', ') || 'One layout only'}</dd>
        </div>
        <div>
          <dt>Surfaces</dt>
          <dd>{w.surfaces.join(', ') || 'none listed'}</dd>
        </div>
        <div>
          <dt>Needs</dt>
          <dd>Omarchy {w.compat.omarchy}, widgets kit {w.compat.widgetsKit}</dd>
        </div>
        <div>
          <dt>Id</dt>
          <dd><code>{w.id}</code></dd>
        </div>
      </dl>
      <p class="small">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href={REPORT_URL} rel="noopener noreferrer">Open a bug report</a> about this listing or the
        site.
      </p>
    </section>
  </div>

  {#if w.layout && w.sampleData}
    <section class="block" aria-labelledby="h-layout">
      <h2 id="h-layout">Drawn from layout.json</h2>
      <p class="small text-2">
        This is the widget&rsquo;s own pinned <code>layout.json</code>, drawn by the site&rsquo;s
        renderer with sample data. Nothing is requested from GitHub or from your machine, and no
        widget code runs.
      </p>
      <div class="lstage" data-testid="layout-render">
        <LayoutView layout={w.layout} data={w.sampleData} title={w.name} {variant} />
      </div>
    </section>
  {/if}

  <section class="block" aria-labelledby="h-similar">
    <h2 id="h-similar">Similar widgets</h2>
    {#if data.similar.length}
      <ul class="related">
        {#each data.similar as s (s.id)}
          <li>
            <a class="rel" href={resolve('/widgets/[id]', { id: s.id })}>
              <strong>{s.name}</strong>
              <span class="small text-2">{s.summary}</span>
              <span class="tiny muted">{statusLabels[s.status]}</span>
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="small text-2">No other widget in {cats} yet.</p>
    {/if}
  </section>
</div>

<style>
  .lstage {
    width: min(100%, 320px);
    height: 200px;
  }
  .page {
    padding-block: 24px 80px;
    display: flex;
    flex-direction: column;
    gap: 40px;
  }
  .crumbs {
    display: flex;
    gap: 8px;
    color: var(--muted);
    margin-bottom: -16px;
  }
  .head {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .lede {
    max-width: 72ch;
    font-size: var(--fs-3);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    color: var(--text-2);
    font-size: 13px;
    line-height: 22px;
  }
  .chip[data-status='planned'] {
    border-style: dashed;
  }
  .chip[data-status='stable'] {
    border-color: var(--brand);
    color: var(--text);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .actions :global(a) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .top,
  .two {
    display: grid;
    gap: 40px;
    grid-template-columns: minmax(0, 1fr);
  }
  @media (min-width: 1000px) {
    .top {
      grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);
      align-items: start;
    }
    .two {
      grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);
    }
    .side {
      position: sticky;
      top: calc(var(--header-hs) + 16px);
    }
  }
  .side,
  .col {
    display: flex;
    flex-direction: column;
    gap: 32px;
    min-width: 0;
  }
  .block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .block > * {
    max-width: 100%;
  }
  .block h2 {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .about {
    max-width: 72ch;
    white-space: pre-line;
  }
  .try {
    align-self: stretch;
    min-width: 0;
  }
  .pstage {
    align-self: stretch;
    border: 1px solid var(--border-strong);
  }
  .controls {
    align-self: stretch;
    display: grid;
    gap: 12px 24px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  }
  .ctl {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .resize {
    margin: 0;
    padding: 0;
    border: 0;
    grid-column: 1 / -1;
    display: grid;
    gap: 4px 24px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  }
  .resize legend {
    grid-column: 1 / -1;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .rs {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .num {
    font-family: var(--font-mono);
  }
  .label {
    color: var(--text-2);
  }
  input[type='range'] {
    width: 100%;
    min-height: 32px;
    accent-color: var(--brand);
  }
  input[type='range']:focus-visible,
  .seg button:focus-visible,
  .rel:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .seg {
    display: flex;
    flex-wrap: wrap;
  }
  .seg button {
    min-height: 32px;
    padding: 0 12px;
    font: 700 14px / 20px var(--font-mono);
    color: var(--text);
    background: transparent;
    border: 1px solid var(--border-strong);
    cursor: pointer;
    margin: 0 -1px -1px 0;
  }
  .seg button[aria-pressed='true'] {
    background: var(--brand);
    border-color: var(--brand);
    color: var(--brand-ink);
  }
  .side pre {
    align-self: stretch;
  }
  .dl {
    margin: 0;
    display: grid;
    gap: 8px;
    align-self: stretch;
  }
  .dl > div {
    display: grid;
    grid-template-columns: minmax(100px, 130px) minmax(0, 1fr);
    gap: 12px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .access {
    margin: 0;
    align-self: stretch;
    border: 1px solid var(--border);
  }
  .access > div {
    display: grid;
    grid-template-columns: minmax(120px, 150px) minmax(0, 1fr);
    gap: 12px;
    padding: 10px 14px;
  }
  .access dt {
    display: flex;
    align-items: baseline;
    gap: 8px;
    color: var(--text-2);
  }
  .access dt :global(.ico) {
    align-self: center;
  }
  @media (max-width: 520px) {
    .access > div {
      grid-template-columns: minmax(0, 1fr);
      gap: 4px;
    }
  }
  .access > div + div {
    border-top: 1px solid var(--border);
  }
  .access ul,
  .related {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .access li.none {
    color: var(--muted);
  }
  .warn {
    padding: 8px 12px;
    border: 1px solid var(--brand);
    border-left-width: 4px;
  }
  .scroll {
    align-self: stretch;
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 8px 12px 8px 0;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--border);
  }
  thead th {
    color: var(--muted);
    font-weight: 400;
  }
  tbody th {
    font-weight: 400;
  }
  .related {
    align-self: stretch;
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  }
  .rel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    height: 100%;
    padding: 12px 16px;
    color: var(--text);
    text-decoration: none;
    border: 1px solid var(--border-strong);
  }
  .rel:hover {
    border-color: var(--brand);
  }
</style>
