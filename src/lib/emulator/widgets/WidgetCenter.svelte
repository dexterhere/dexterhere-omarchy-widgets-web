<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { docsUrl, sitePath } from '../../site';
  import { getAll, statusLabels, tierLabels } from '../../registry';
  import type { EmulatorApi } from '../api';
  import { sheetIn } from '../fx';
  import Inspector from './Inspector.svelte';
  import { miniRects } from './model';
  import { isPreviewOnly, labelOf, type TabId, type WidgetLayerState } from './store.svelte';

  // The proposed Widget Center: a bottom sheet over the desktop. Opening it enters edit mode.
  let {
    wl,
    api,
    themeName,
    onPickTheme
  }: {
    wl: WidgetLayerState;
    api: EmulatorApi;
    themeName: string;
    onPickTheme?: () => void;
  } = $props();

  const TABS: { id: TabId; name: string }[] = [
    { id: 'installed', name: 'Installed' },
    { id: 'discover', name: 'Discover' },
    { id: 'layouts', name: 'Layouts' },
    { id: 'create', name: 'Create' }
  ];
  const all = getAll();
  let sheet: HTMLElement;
  let layoutName = $state('');

  // The shell focuses the first button when a panel opens; the selected tab is the right target.
  onMount(() => {
    const raf = requestAnimationFrame(() =>
      sheet.querySelector<HTMLElement>('[role="tab"][tabindex="0"]')?.focus()
    );
    return () => cancelAnimationFrame(raf);
  });

  async function tabKey(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.id === wl.tab);
    const n =
      e.key === 'ArrowRight'
        ? (i + 1) % TABS.length
        : e.key === 'ArrowLeft'
          ? (i + TABS.length - 1) % TABS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? TABS.length - 1
              : -1;
    if (n < 0) return;
    e.preventDefault();
    wl.tab = TABS[n].id;
    await tick();
    sheet.querySelector<HTMLElement>(`[data-tab="${wl.tab}"]`)?.focus();
  }

  // Focus trap: Tab stays inside the sheet. Escape is handled by the shell (closes the sheet).
  function trap(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const f = [
      ...sheet.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]'
      )
    ].filter((el) => el.getClientRects().length > 0);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const health = (reg: string) =>
    wl.count(reg) === 0
      ? 'Not on the desktop (sample)'
      : isPreviewOnly(reg)
        ? 'Preview, sample data, not real data'
        : 'Healthy, updated 2 s ago (sample)';

  const accessRows = (w: (typeof all)[number]) =>
    [
      ['Data', w.access.data],
      ['Network', w.access.network],
      ['Files', w.access.files],
      ['Programs', w.access.programs],
      ['Secrets', w.access.secrets]
    ] as [string, string[]][];

  function pickInstalled(reg: string) {
    const i = wl.items.filter((o) => o.reg === reg).at(-1);
    if (i) wl.select(i.id);
  }

  const SPEC = `{
  "id": "io.github.you.my-clock",
  "kind": "spec",
  "title": "My clock",
  "bind": { "topic": "system.time", "field": "hm" },
  "size": "wide",
  "color": "accent"
}`;
  const docsHref = docsUrl('/docs/v0.1/create/choose-a-path/');
  const doors = [
    {
      name: 'Tweak a template',
      text: 'Start from a clock, battery or list and change its blocks, sizes and variants. No code.'
    },
    {
      name: 'Design visually',
      text: 'Arrange blocks on a canvas and bind them to sample topics. The result is a spec widget.'
    },
    {
      name: 'Write code',
      text: 'A code widget for anything a spec cannot express. It is reviewed before it is listed.'
    }
  ];
</script>

<div
  class="panel sheet"
  bind:this={sheet}
  use:sheetIn
  role="dialog"
  aria-modal="true"
  aria-label="Widget Center"
  data-widget-center
  data-panel="widgets"
  tabindex="-1"
  onkeydown={trap}
>
  <header>
    <h2>Widget Center <span class="prop">Proposed</span></h2>
    <span class="mode">Edit mode is on</span>
  </header>

  <div class="tabrow">
    <div
      class="tabs"
      role="tablist"
      aria-label="Widget Center sections"
      tabindex="-1"
      onkeydown={tabKey}
    >
      {#each TABS as t (t.id)}
        <button
          type="button"
          role="tab"
          id="wc-tab-{t.id}"
          data-tab={t.id}
          aria-selected={wl.tab === t.id}
          aria-controls="wc-panel"
          tabindex={wl.tab === t.id ? 0 : -1}
          onclick={() => (wl.tab = t.id)}>{t.name}</button
        >
      {/each}
    </div>
    <button type="button" class="close" onclick={() => api.closeWidgetCenter()}
      >Close<span class="sr"> Widget Center</span></button
    >
  </div>

  <div class="body">
    <div class="main" id="wc-panel" role="tabpanel" aria-labelledby="wc-tab-{wl.tab}">
      {#if wl.tab === 'installed'}
        {#if wl.installed.length === 0}
          <p class="empty">Nothing installed yet. Open Discover to add a widget.</p>
        {/if}
        <ul class="rows">
          {#each wl.installed as reg (reg)}
            {@const n = wl.count(reg)}
            <li
              class="row"
              data-installed={reg}
              aria-current={wl.selectedInst?.reg === reg ? 'true' : undefined}
            >
              <button
                type="button"
                class="pick"
                disabled={n === 0}
                onclick={() => pickInstalled(reg)}
              >
                <strong>{labelOf(reg)}</strong><span class="sr">, inspect</span>
                {#if isPreviewOnly(reg)}<span class="tag">preview</span>{/if}
                <span class="meta">{health(reg)}</span>
              </button>
              <span class="count" data-count={n}>{n} on desktop</span>
              <button
                type="button"
                role="switch"
                class="switch"
                aria-checked={n > 0}
                aria-label="On desktop: {labelOf(reg)}"
                onclick={() => wl.toggle(reg)}
                ><span aria-hidden="true">{n > 0 ? 'On' : 'Off'}</span></button
              >
              <button
                type="button"
                class="btn"
                aria-label="Add another {labelOf(reg)}"
                disabled={n === 0}
                onclick={() => wl.addAnother(reg)}>Add another</button
              >
            </li>
          {/each}
        </ul>
      {:else if wl.tab === 'discover'}
        <ul class="cards">
          {#each all as w (w.id)}
            {@const inst = wl.isInstalled(w.id)}
            {@const n = wl.count(w.id)}
            <li class="card" data-discover={w.id}>
              <h3>{labelOf(w.id)}</h3>
              <p class="status">
                {statusLabels[w.status]}. {tierLabels[w.tier].label}.
              </p>
              <p class="sum">{w.summary}</p>
              <dl class="needs" aria-label="Data {labelOf(w.id)} needs">
                {#each accessRows(w) as [k, items] (k)}
                  <div>
                    <dt>{k}</dt>
                    <dd>{(items.length ? items : ['none']).join('; ')}</dd>
                  </div>
                {/each}
              </dl>
              <div class="act">
                {#if !inst}
                  <button
                    type="button"
                    class="btn primary"
                    data-install={w.id}
                    onclick={() => wl.install(w.id)}
                    >Install {labelOf(w.id)}{w.installable ? '' : ' (preview)'}</button
                  >
                {:else}
                  <span class="tag">Installed</span>
                  {#if n === 0}
                    <button type="button" class="btn" onclick={() => wl.show(w.id)}
                      >Add to desktop<span class="sr"> {labelOf(w.id)}</span></button
                    >
                  {:else}
                    <button type="button" class="btn" onclick={() => wl.hide(w.id)}
                      >Remove from desktop<span class="sr"> {labelOf(w.id)}</span></button
                    >
                  {/if}
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {:else if wl.tab === 'layouts'}
        <form
          class="save"
          onsubmit={(e) => {
            e.preventDefault();
            wl.saveLayout(layoutName);
            layoutName = '';
          }}
        >
          <label
            >Layout name <input
              type="text"
              maxlength="40"
              placeholder="My layout"
              bind:value={layoutName}
            /></label
          >
          <button type="submit" class="btn primary">Save current layout</button>
          <span class="meta">Kept in memory for this page only.</span>
        </form>
        {#if wl.layouts.length === 0}<p class="empty">No layouts yet.</p>{/if}
        <ul class="cards lay">
          {#each wl.layouts as l (l.id)}
            <li class="card" data-layout={l.name}>
              <div
                class="mini"
                role="img"
                aria-label="Miniature: {l.items.length} widget{l.items.length === 1 ? '' : 's'}"
              >
                {#each miniRects(l.items) as r (r.id)}
                  <i
                    style:left="{r.left}%"
                    style:top="{r.top}%"
                    style:width="{r.width}%"
                    style:height="{r.height}%"
                  ></i>
                {/each}
              </div>
              <h3>{l.name}</h3>
              <p class="meta">{l.items.length} widget{l.items.length === 1 ? '' : 's'}</p>
              <div class="act">
                <button type="button" class="btn primary" onclick={() => wl.applyLayout(l.id)}
                  >Apply<span class="sr"> layout {l.name}</span></button
                >
                <button type="button" class="btn" onclick={() => wl.deleteLayout(l.id)}
                  >Delete<span class="sr"> layout {l.name}</span></button
                >
              </div>
            </li>
          {/each}
        </ul>
      {:else}
        <ul class="cards doors">
          {#each doors as d (d.name)}
            <li class="card">
              <h3>{d.name}</h3>
              <p class="sum">{d.text}</p>
            </li>
          {/each}
        </ul>
        <div class="spec">
          <p class="meta">A spec widget is data, not code. Draft schema v0, shown as a sample.</p>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <pre tabindex="0"><code>{SPEC}</code></pre>
          <p class="links">
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a href={docsHref}>Choose a path in the docs</a>
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a href={sitePath('/contribute/')}>Contribute a widget</a>
          </p>
        </div>
      {/if}
    </div>

    {#if wl.selectedInst}
      <aside class="side">
        <Inspector {wl} inst={wl.selectedInst} />
      </aside>
    {/if}
  </div>

  <footer>
    <button type="button" class="btn" data-sheet-theme onclick={() => onPickTheme?.()}>
      Theme: {themeName}
    </button>
    <span class="meta"
      >Esc closes this sheet. Then Tab reaches the widgets: arrows move, Shift and arrows resize,
      Delete removes.</span
    >
  </footer>
</div>

<style>
  .sheet {
    position: absolute;
    z-index: 40;
    left: 8px;
    right: 8px;
    bottom: 8px;
    height: min(54%, 460px);
    min-height: 268px;
    max-height: calc(100% - var(--bar-h) - 16px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    background: var(--surface);
    color: var(--text);
    border: 2px solid var(--border-strong);
    font: 400 12px / 16px var(--font-mono);
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  h2 {
    margin: 0;
    font: 700 14px / 20px var(--font-mono);
    letter-spacing: 0;
  }
  .prop,
  .tag {
    margin-left: 4px;
    padding: 0 4px;
    font: 400 12px / 16px var(--font-mono);
    border: 1px solid var(--border-strong);
    color: var(--text);
  }
  .tag {
    border-style: dashed;
  }
  .mode {
    color: var(--text-2);
    flex: 1;
  }
  .tabrow {
    display: flex;
    align-items: flex-end;
    border-bottom: 1px solid var(--border-strong);
  }
  .tabs {
    flex: 1;
    display: flex;
    gap: 0;
  }
  .tabs [role='tab'] {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    padding: 4px 12px;
    color: var(--text-2);
    border: 1px solid transparent;
    border-bottom: 0;
    margin-bottom: -1px;
  }
  .tabs [role='tab']:hover {
    color: var(--text);
  }
  .tabs [role='tab'][aria-selected='true'] {
    color: var(--text);
    font-weight: 700;
    background: var(--surface-2);
    border-color: var(--border-strong);
    border-top: 2px solid var(--brand);
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 12px;
  }
  .main {
    flex: 1;
    min-width: 0;
    overflow: auto;
    padding: 2px 2px 4px;
  }
  .side {
    flex: none;
    width: 232px;
    overflow: auto;
    padding-left: 12px;
    border-left: 1px solid var(--border-strong);
  }
  footer {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }
  .meta {
    color: var(--muted);
    max-width: none;
    margin: 0;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .empty {
    margin: 4px 0;
    color: var(--text-2);
    max-width: none;
  }
  button:focus-visible,
  a:focus-visible,
  input:focus-visible,
  pre:focus-visible,
  .main:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .btn,
  .close,
  .switch,
  .pick {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    padding: 3px 8px;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
  }
  .btn:hover:not(:disabled),
  .close:hover,
  .switch:hover {
    border-color: var(--brand);
  }
  .btn:disabled,
  .pick:disabled {
    cursor: not-allowed;
    color: var(--muted);
  }
  .btn.primary {
    background: var(--brand);
    color: var(--brand-ink);
    border-color: var(--brand);
    font-weight: 700;
  }
  .btn.primary:hover {
    background: var(--text);
    border-color: var(--text);
  }
  .btn:focus-visible,
  .close:focus-visible,
  .switch:focus-visible,
  .pick:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .close {
    margin: 0 0 3px auto;
  }
  .rows,
  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto auto;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border: 1px solid var(--border);
  }
  .row[aria-current='true'] {
    border-color: var(--brand);
    background: var(--brand-soft);
  }
  .pick {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    text-align: left;
    background: transparent;
    border-color: transparent;
    min-width: 0;
  }
  .pick:hover:not(:disabled) {
    border-color: var(--border-strong);
  }
  .pick .meta {
    flex-basis: 100%;
  }
  .count {
    color: var(--text-2);
    white-space: nowrap;
  }
  .switch[aria-checked='true'] {
    background: var(--brand);
    color: var(--brand-ink);
    border-color: var(--brand);
    font-weight: 700;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(236px, 1fr));
    gap: 8px;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    min-width: 0;
    border: 1px solid var(--border-strong);
    background: var(--bg);
  }
  .card h3 {
    margin: 0;
    font: 700 12px / 16px var(--font-mono);
    letter-spacing: 0;
  }
  .status {
    margin: 0;
    color: var(--text-2);
    max-width: none;
  }
  .sum {
    margin: 0;
    max-width: none;
    color: var(--text-2);
  }
  .needs {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .needs div {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 6px;
  }
  .needs dt {
    color: var(--muted);
  }
  .needs dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .act {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: auto;
    padding-top: 4px;
  }
  .save {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .save label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-2);
  }
  input[type='text'] {
    font: inherit;
    padding: 3px 6px;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    border-radius: 0;
    width: 160px;
  }
  .lay {
    grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
  }
  .mini {
    position: relative;
    aspect-ratio: 16 / 9;
    background: var(--bg-deep);
    border: 1px solid var(--border);
  }
  .mini i {
    position: absolute;
    box-sizing: border-box;
    background: var(--brand-soft);
    border: 1px solid var(--brand);
  }
  .doors {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
  .spec {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  pre {
    margin: 0;
    padding: 6px 8px;
    overflow: auto;
    background: var(--bg-deep);
    border: 1px solid var(--border);
    color: var(--text);
    font: 400 12px / 16px var(--font-mono);
  }
  .links {
    margin: 0;
    display: flex;
    gap: 16px;
    max-width: none;
  }
  a {
    color: var(--text);
    text-decoration: underline;
  }
  @container (max-width: 760px) {
    .side {
      display: none;
    }
  }
</style>
