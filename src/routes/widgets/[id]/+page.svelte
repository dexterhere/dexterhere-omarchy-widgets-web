<script lang="ts">
  import { resolve } from '$app/paths';
  import Badges from '../../../lib/components/Badges.svelte';
  import CopyButton from '../../../lib/components/CopyButton.svelte';
  import WidgetPreview from '../../../lib/components/WidgetPreview.svelte';
  import { SIZE_CLASSES, fitToClass, snap, type SizeClass } from '../../../lib/desktop/layout';
  import {
    categoryLabels,
    declaredTierNote,
    statusLabels,
    tierLabels
  } from '../../../lib/registry';
  import { REPORT_URL, safeRepoUrl, shortCommit } from '../../../lib/registry/links';
  import { CARD_SIZE, previewType } from '../../../lib/registry/preview';

  let { data } = $props();
  const w = $derived(data.widget);

  const type = $derived(previewType(w.id));
  const classes = $derived(
    type ? (Object.keys(SIZE_CLASSES[type]) as SizeClass[]) : ([] as SizeClass[])
  );
  const repo = $derived(safeRepoUrl(w.repo));
  const short = $derived(shortCommit(w.commit));
  const note = $derived(declaredTierNote(w));

  // Preview state. Re-seeded when the widget changes (client navigation between details).
  let cls = $state<SizeClass>('compact');
  let pw = $state(0);
  let ph = $state(0);
  let variant = $state('');
  let boxW = $state(0);
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
  // Scale down (never up) so the widget always fits a narrow screen.
  const zoom = $derived(boxW > 0 && pw > boxW - 32 ? Math.max(0.3, (boxW - 32) / pw) : 1);

  const installCmd = $derived(`ow install ${w.id}@${w.commit}`);
  const manualCmd = $derived(repo ? `omarchy plugin add ${repo}` : '');

  const accessRows = $derived([
    { label: 'Data', items: w.access.data },
    { label: 'Network', items: w.access.network },
    { label: 'Files', items: w.access.files },
    { label: 'Runs programs', items: w.access.programs },
    { label: 'Secrets', items: w.access.secrets }
  ]);

  const limits = (s: (typeof w.settings)[number]) =>
    s.options?.length
      ? `one of ${s.options.join(', ')}`
      : s.min !== undefined || s.max !== undefined
        ? `${s.min ?? 'any'} to ${s.max ?? 'any'}`
        : 'none';
</script>

<svelte:head>
  <title>{w.name} - Omarchy Widgets</title>
  <meta name="description" content={w.summary} />
</svelte:head>

<div class="container wide page">
  <header class="head">
    <h1>{w.name}</h1>
    <p class="text-2">{w.summary}</p>
    <Badges {w} />
  </header>

  <div class="top">
    <section class="block" aria-labelledby="h-preview">
      <h2 id="h-preview">Preview</h2>
      {#if type && spec}
        <div class="pstage" bind:clientWidth={boxW}>
          <div class="fit" style:zoom>
            <WidgetPreview {type} w={pw} h={ph} {variant} />
          </div>
        </div>
        <div class="controls">
          <div class="ctl" role="group" aria-label="Size class">
            <span class="label small">Size class</span>
            <div class="seg">
              {#each classes as c (c)}
                <button type="button" aria-pressed={cls === c} onclick={() => pick(c)}>{c}</button>
              {/each}
            </div>
          </div>
          <div class="ctl">
            <label class="label small" for="pw"
              >Width {pw}px (limits {spec.minW} to {spec.maxW})</label
            >
            <input id="pw" type="range" min={spec.minW} max={spec.maxW} step="8" bind:value={pw} />
          </div>
          <div class="ctl">
            <label class="label small" for="ph"
              >Height {ph}px (limits {spec.minH} to {spec.maxH})</label
            >
            <input id="ph" type="range" min={spec.minH} max={spec.maxH} step="8" bind:value={ph} />
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
        </div>
        <p class="tiny muted">
          Sample data, not your machine. The preview follows the page theme: press <kbd>T</kbd> to change
          it. Only the clock has more than one rendering; other variants show the same one.
        </p>
      {:else}
        <div class="pstage none"><p class="small muted">No preview yet</p></div>
        <p class="tiny muted">
          This listing has no live preview. The preview follows the page theme once one exists.
        </p>
      {/if}
    </section>

    <section class="block" aria-labelledby="h-install">
      <h2 id="h-install">Install</h2>
      {#if !w.installable}
        <p><strong>Not installable yet.</strong></p>
        <p class="small text-2">
          This is a {w.status === 'planned' ? 'concept' : 'listing'} with status &ldquo;{statusLabels[
            w.status
          ]}&rdquo;. {tierLabels[w.tier].text}
        </p>
      {:else}
        <div class="cmd">
          <p class="small">
            <span class="tag">Planned</span> Install with the <code>ow</code> command line tool, which
            does not exist yet.
          </p>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <pre tabindex="0"><code>{installCmd}</code></pre>
          <CopyButton text={installCmd} label="Copy install command" />
        </div>
        {#if manualCmd}
          <div class="cmd">
            <p class="small">
              Manual alternative. This installs the latest commit of the repository, not the pinned
              one; pinned installs are planned with <code>ow install</code>. Compare the commit you
              get with the one listed below before you trust it:
            </p>
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <pre tabindex="0"><code>{manualCmd}</code></pre>
            <CopyButton text={manualCmd} label="Copy manual command" />
          </div>
        {/if}
      {/if}
      <h3 class="sub">Needs</h3>
      <dl class="dl small">
        <div>
          <dt>Omarchy</dt>
          <dd>{w.compat.omarchy}</dd>
        </div>
        <div>
          <dt>Widgets kit</dt>
          <dd>{w.compat.widgetsKit}</dd>
        </div>
        <div>
          <dt>Surfaces</dt>
          <dd>{w.surfaces.join(', ') || 'none listed'}</dd>
        </div>
      </dl>
    </section>
  </div>

  <section class="block" aria-labelledby="h-access">
    <h2 id="h-access">What it can access</h2>
    <p class="small text-2">
      Generated from the widget&rsquo;s own files. Nothing here is hand-written.
    </p>
    <dl class="access">
      {#each accessRows as row (row.label)}
        <div>
          <dt>{row.label}</dt>
          <dd>
            <ul>
              {#each row.items.length ? row.items : ['none'] as item, i (i)}<li>{item}</li>{/each}
            </ul>
          </dd>
        </div>
      {/each}
    </dl>
  </section>

  <section class="block" aria-labelledby="h-trust">
    <h2 id="h-trust">Trust</h2>
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

  <div class="two">
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

    <section class="block" aria-labelledby="h-variants">
      <h2 id="h-variants">Variants</h2>
      {#if w.variants.length}
        <ul class="plain small">
          {#each w.variants as v (v)}<li>{v}</li>{/each}
        </ul>
      {:else}
        <p class="small text-2">One layout only.</p>
      {/if}
      <h3 class="sub">Size classes</h3>
      <dl class="dl small">
        {#each w.sizeClasses as s (s.name)}
          <div>
            <dt>{s.name}</dt>
            <dd>{s.min[0]} by {s.min[1]} up to {s.max[0]} by {s.max[1]}</dd>
          </div>
        {/each}
      </dl>
    </section>
  </div>

  <div class="two">
    <section class="block" aria-labelledby="h-source">
      <h2 id="h-source">Source</h2>
      <dl class="dl small">
        <div>
          <dt>Repository</dt>
          <dd>
            {#if repo}<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={repo} rel="noopener noreferrer">{repo.replace('https://', '')}</a>
            {:else}<span class="muted">No valid repository link</span>{/if}
          </dd>
        </div>
        <div>
          <dt>Pinned commit</dt>
          <dd>
            {#if short}<code title={w.commit}>{short}</code>{:else}<span class="muted">none</span
              >{/if}
          </dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>{w.license}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{w.version}</dd>
        </div>
        <div>
          <dt>Category</dt>
          <dd>{categoryLabels[w.category]}</dd>
        </div>
        <div>
          <dt>Id</dt>
          <dd><code>{w.id}</code></dd>
        </div>
      </dl>
    </section>

    <section class="block" aria-labelledby="h-changelog">
      <h2 id="h-changelog">Changelog</h2>
      <p class="small text-2">No changelog yet.</p>
      <h3 class="sub">Report a problem</h3>
      <p class="small">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href={REPORT_URL} rel="noopener noreferrer">Open a bug report</a> about this listing or the
        site.
      </p>
    </section>
  </div>

  <section class="block" aria-labelledby="h-similar">
    <h2 id="h-similar">Similar widgets</h2>
    {#if data.similar.length}
      <ul class="plain small">
        {#each data.similar as s (s.id)}
          <li>
            <a href={resolve('/widgets/[id]', { id: s.id })}>{s.name}</a>
            <span class="muted">({statusLabels[s.status]})</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="small text-2">No other widget in {categoryLabels[w.category]} yet.</p>
    {/if}
  </section>
</div>

<style>
  .page {
    padding-block: 48px 80px;
    display: flex;
    flex-direction: column;
    gap: 40px;
  }
  .head {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .top,
  .two {
    display: grid;
    gap: 40px;
    grid-template-columns: minmax(0, 1fr);
  }
  @media (min-width: 900px) {
    .top {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    }
    .two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
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
  .sub {
    margin-top: 8px;
    font-size: 14px;
  }
  .pstage {
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 240px;
    padding: 16px;
    overflow: hidden;
    background: var(--bg-deep);
    border: 1px solid var(--border);
  }
  .pstage.none {
    justify-content: flex-start;
    align-items: flex-start;
    background: var(--surface-2);
  }
  .controls {
    align-self: stretch;
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  }
  .ctl {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .label {
    color: var(--text-2);
  }
  input[type='range'] {
    width: 100%;
    min-height: 32px;
    accent-color: var(--brand);
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
  .cmd {
    align-self: stretch;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .cmd pre {
    align-self: stretch;
  }
  .tag {
    padding: 0 6px;
    border: 1px dashed var(--border-strong);
    font-weight: 700;
  }
  .dl {
    margin: 0;
    display: grid;
    gap: 4px;
    align-self: stretch;
  }
  .dl div {
    display: grid;
    grid-template-columns: minmax(110px, 140px) minmax(0, 1fr);
    gap: 12px;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    min-width: 0;
  }
  .access {
    margin: 0;
    align-self: stretch;
    border: 1px solid var(--border);
  }
  .access > div {
    display: grid;
    grid-template-columns: minmax(110px, 160px) minmax(0, 1fr);
    gap: 16px;
    padding: 12px 16px;
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
  .plain {
    margin: 0;
    padding: 0;
    list-style: none;
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
</style>
