<script lang="ts">
  import { tick } from 'svelte';
  import { ICONS, ROLES, SIZES, type IconName, type Role, type Size } from '../registry/layout';
  import { FIELDS, fieldOf, type Field } from './catalog';
  import {
    KINDS,
    MAX_VARIANTS,
    ROOT,
    VARIANT_NAME,
    addVariant,
    allBinds,
    appendLeaf,
    fieldsFor,
    kindLabel,
    kindOf,
    leaves,
    makeNode,
    moveAt,
    needs,
    patchAt,
    removeAt,
    removeVariant,
    replaceAt,
    takesBind,
    takesText,
    treeOf,
    unitOf,
    withTree,
    type Kind,
    type Part
  } from './edit';
  import Confirm from './Confirm.svelte';
  import { TEMPLATES } from './templates';
  import type { MakeStore } from './store.svelte';

  let { store }: { store: MakeStore } = $props();
  const lay = $derived(store.draft.layout);
  const key = $derived(
    store.style !== ROOT && lay.variants && Object.hasOwn(lay.variants, store.style)
      ? store.style
      : ROOT
  );
  const root = $derived(treeOf(lay, key));
  const parts = $derived(leaves(root));
  const problems = $derived(store.layoutProblems.filter((p) => p.tree === key));
  const general = $derived(
    problems.filter((p) => p.path === null || !parts.some((x) => x.path.join() === p.path!.join()))
  );
  const names = $derived(Object.keys(lay.variants ?? {}));

  let note = $state('');
  let head: HTMLElement | undefined = $state();
  const set = (node: Parameters<typeof withTree>[2]) =>
    (store.draft.layout = withTree($state.snapshot(store.draft.layout), key, node));
  const snap = () => $state.snapshot(root) as typeof root;

  const pid = (i: number, f: string) => `p-${key || 'default'}-${i}-${f}`;

  function patch(p: Part, o: Record<string, unknown>) {
    set(patchAt(snap(), p.path, o));
  }
  function setKind(p: Part, k: Kind) {
    set(replaceAt(snap(), p.path, makeNode(k, $state.snapshot(p.node) as Part['node'])));
    note = `Part changed to ${kindLabel(k)}.`;
  }
  function setField(p: Part, v: string) {
    const [topic, field] = v.split('|');
    const f = fieldOf(topic, field);
    if (!f) return;
    patch(p, {
      bind: { topic, field },
      ...(p.node.type === 'value' ? { unit: unitOf(f) || undefined } : {})
    });
  }
  function move(p: Part, d: -1 | 1, i: number) {
    set(moveAt(snap(), p.path, d));
    note = `Part ${i + 1} moved ${d < 0 ? 'up' : 'down'}.`;
  }
  async function remove(i: number) {
    set(removeAt(snap(), parts[i].path));
    note = `Part ${i + 1} removed.`;
    await tick();
    head?.focus();
  }
  let addKind = $state<Kind>('value');
  async function add() {
    set(appendLeaf(snap(), makeNode(addKind)));
    note = `${kindLabel(addKind)} added as part ${parts.length + 1}.`;
    await tick();
    document.getElementById(pid(parts.length - 1, 'kind'))?.focus();
  }

  // Styles
  let newName = $state('');
  const nameErr = $derived(
    !newName
      ? ''
      : !VARIANT_NAME.test(newName)
        ? 'Use lowercase letters, numbers and hyphens, starting with a letter, up to 24 characters.'
        : names.includes(newName)
          ? 'A style with that name exists.'
          : names.length >= MAX_VARIANTS
            ? `At most ${MAX_VARIANTS} styles.`
            : ''
  );
  function addStyle() {
    if (!newName || nameErr) return;
    store.draft.layout = addVariant($state.snapshot(store.draft.layout), newName, key);
    store.style = newName;
    note = `Style ${newName} added as a copy of the one you were on.`;
    newName = '';
  }
  function dropStyle() {
    const gone = key;
    store.draft.layout = removeVariant($state.snapshot(store.draft.layout), gone);
    store.style = ROOT;
    note = `Style ${gone} removed.`;
  }

  const reads = $derived(
    [...new Set(allBinds(lay).map((b) => `${b.topic}.${b.field}`))]
      .map((id) => FIELDS.find((f) => f.id === id))
      .filter((f): f is Field => !!f)
  );
  const topics = [...new Set(FIELDS.map((f) => f.topic))];
  const ROLE_LABEL: Record<Role, string> = {
    accent: 'Accent (the theme highlight)',
    foreground: 'Foreground (normal text)',
    secondary: 'Secondary',
    muted: 'Muted (quiet)'
  };
  const SIZE_LABEL: Record<Size, string> = {
    sm: 'Small',
    md: 'Medium',
    lg: 'Large',
    xl: 'Extra large'
  };
  const hasSize = (k: Kind) => !['bar', 'ring', 'divider', 'spacer'].includes(k);
  const hasColor = (k: Kind) => !['divider', 'spacer'].includes(k);
  const errsFor = (p: Part) => problems.filter((x) => x.path && x.path.join() === p.path.join());
</script>

<div class="shape">
  <p class="text-2 lead">
    Choose what your widget shows. The preview updates as you type. The numbers are sample data, so
    nothing is read from your computer.
  </p>

  <section aria-labelledby="sty-h" class="blk">
    <h3 id="sty-h">Layout style</h3>
    <p class="hint">
      A style is one way to arrange the widget, for example a small chip or a big card. Most widgets
      need just one.
    </p>
    <div class="seg" role="radiogroup" aria-labelledby="sty-h">
      <label class:on={key === ROOT}
        ><input
          type="radio"
          name="style"
          value={ROOT}
          checked={key === ROOT}
          onchange={() => (store.style = ROOT)}
        />Default</label
      >
      {#each names as n (n)}
        <label class:on={key === n}
          ><input
            type="radio"
            name="style"
            value={n}
            checked={key === n}
            onchange={() => (store.style = n)}
          />{n}</label
        >
      {/each}
    </div>
    <div class="addstyle">
      <div class="field">
        <label for="m-newstyle">New style name</label>
        <input
          id="m-newstyle"
          type="text"
          autocomplete="off"
          spellcheck="false"
          maxlength="40"
          placeholder="chip"
          bind:value={newName}
          aria-invalid={nameErr ? 'true' : undefined}
          aria-describedby={nameErr ? 'm-newstyle-e' : undefined}
          onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addStyle())}
        />
        {#if nameErr}<p class="err" id="m-newstyle-e">{nameErr}</p>{/if}
      </div>
      <button type="button" class="btn" onclick={addStyle} disabled={!newName || !!nameErr}>
        Add a style (copy of {key === ROOT ? 'Default' : key})
      </button>
      {#if key !== ROOT}
        <Confirm
          label="Remove style {key}"
          question="Remove the style {key}?"
          yes="Remove it"
          onconfirm={dropStyle}
        />
      {/if}
    </div>
  </section>

  <section aria-labelledby="parts-h" class="blk">
    <h3 id="parts-h" tabindex="-1" bind:this={head}>Parts ({parts.length})</h3>
    <p class="hint">
      Each part is one thing on the widget. Parts are shown in order from the top. This is the
      {key === ROOT ? 'Default' : `"${key}"`} style.
    </p>
    {#each general as g, gi (gi)}<p class="err" role="alert">{g.text}</p>{/each}
    <ol class="parts">
      {#each parts as p, i (p.path.join('-') + ':' + i)}
        {@const k = kindOf(p.node)}
        {@const bind = 'bind' in p.node ? p.node.bind : undefined}
        {@const f = bind ? fieldOf(bind.topic, bind.field) : undefined}
        {@const errs = errsFor(p)}
        <li class="part" aria-labelledby={pid(i, 'h')}>
          <div class="phead">
            <h4 id={pid(i, 'h')}>Part {i + 1}: {kindLabel(k)}</h4>
            <div class="mv">
              <button
                type="button"
                class="btn small"
                disabled={p.path[p.path.length - 1] === 0}
                onclick={() => move(p, -1, i)}
                aria-label="Move part {i + 1} up">Up</button
              >
              <button
                type="button"
                class="btn small"
                onclick={() => move(p, 1, i)}
                aria-label="Move part {i + 1} down">Down</button
              >
              <button
                type="button"
                class="btn small"
                disabled={parts.length === 1}
                onclick={() => remove(i)}
                aria-label="Remove part {i + 1}">Remove</button
              >
            </div>
          </div>
          <div class="pgrid">
            <div class="field">
              <label for={pid(i, 'kind')}>Type</label>
              <select
                id={pid(i, 'kind')}
                value={k}
                onchange={(e) => setKind(p, e.currentTarget.value as Kind)}
              >
                {#each KINDS as [id, label] (id)}<option value={id}>{label}</option>{/each}
              </select>
            </div>

            {#if takesBind(k)}
              <div class="field">
                <label for={pid(i, 'data')}>Data</label>
                <select
                  id={pid(i, 'data')}
                  value={bind ? `${bind.topic}|${bind.field}` : ''}
                  onchange={(e) => setField(p, e.currentTarget.value)}
                  aria-describedby={pid(i, 'served')}
                >
                  {#each topics as t (t)}
                    {@const fs = fieldsFor(k).filter((x) => x.topic === t)}
                    {#if fs.length}
                      <optgroup label={t}>
                        {#each fs as x (x.id)}
                          <option value="{x.topic}|{x.field}"
                            >{x.label}{x.served ? '' : ' (planned)'}</option
                          >
                        {/each}
                      </optgroup>
                    {/if}
                  {/each}
                </select>
                <p class="tiny" id={pid(i, 'served')}>
                  {#if f?.served}
                    <span class="tag on">Served today</span> The daemon provides this.
                  {:else}
                    <span class="tag">Planned</span> Not served yet. The web preview uses sample data.
                  {/if}
                  {#if needs(k)}Needs {needs(k) === 'number' ? 'a number' : 'a list'}.{/if}
                </p>
              </div>
            {/if}

            {#if takesText(k)}
              <div class="field">
                <label for={pid(i, 'text')}>Text</label>
                <input
                  id={pid(i, 'text')}
                  type="text"
                  autocomplete="off"
                  maxlength="240"
                  value={'text' in p.node ? p.node.text : ''}
                  oninput={(e) => patch(p, { text: e.currentTarget.value })}
                  aria-invalid={errs.length ? 'true' : undefined}
                  aria-describedby={errs.length ? pid(i, 'err') : undefined}
                />
              </div>
            {/if}

            {#if k === 'value'}
              <div class="field">
                <label for={pid(i, 'unit')}>Unit after the number</label>
                <input
                  id={pid(i, 'unit')}
                  type="text"
                  autocomplete="off"
                  maxlength="12"
                  placeholder="%"
                  value={'unit' in p.node ? (p.node.unit ?? '') : ''}
                  oninput={(e) => patch(p, { unit: e.currentTarget.value || undefined })}
                  aria-invalid={errs.length ? 'true' : undefined}
                  aria-describedby={errs.length ? pid(i, 'err') : undefined}
                />
              </div>
            {/if}

            {#if k === 'icon'}
              <div class="field">
                <label for={pid(i, 'icon')}>Icon</label>
                <select
                  id={pid(i, 'icon')}
                  value={'name' in p.node ? p.node.name : 'cpu'}
                  onchange={(e) => patch(p, { name: e.currentTarget.value as IconName })}
                >
                  {#each ICONS as n (n)}<option value={n}>{n}</option>{/each}
                </select>
              </div>
            {/if}

            {#if k === 'list'}
              <div class="field">
                <label for={pid(i, 'max')}>Rows to show</label>
                <input
                  id={pid(i, 'max')}
                  type="number"
                  min="1"
                  max="50"
                  value={'max' in p.node ? (p.node.max ?? 4) : 4}
                  oninput={(e) => patch(p, { max: e.currentTarget.valueAsNumber || undefined })}
                />
              </div>
            {/if}

            {#if hasColor(k)}
              <div class="field">
                <label for={pid(i, 'color')}>Colour</label>
                <select
                  id={pid(i, 'color')}
                  value={'color' in p.node ? (p.node.color ?? 'foreground') : 'foreground'}
                  onchange={(e) => patch(p, { color: e.currentTarget.value as Role })}
                >
                  {#each ROLES as r (r)}<option value={r}>{ROLE_LABEL[r]}</option>{/each}
                </select>
              </div>
            {/if}

            {#if hasSize(k)}
              <div class="field">
                <label for={pid(i, 'size')}>Size</label>
                <select
                  id={pid(i, 'size')}
                  value={'size' in p.node ? (p.node.size ?? 'md') : 'md'}
                  onchange={(e) => patch(p, { size: e.currentTarget.value as Size })}
                >
                  {#each SIZES as s (s)}<option value={s}>{SIZE_LABEL[s]}</option>{/each}
                </select>
              </div>
            {/if}
          </div>
          {#if errs.length}
            <div id={pid(i, 'err')}>
              {#each errs as e, ei (ei)}<p class="err">Part {i + 1}: {e.text}</p>{/each}
            </div>
          {/if}
        </li>
      {/each}
    </ol>

    <div class="addpart">
      <div class="field">
        <label for="m-addkind">Add a part</label>
        <select id="m-addkind" bind:value={addKind}>
          {#each KINDS as [id, label] (id)}<option value={id}>{label}</option>{/each}
        </select>
      </div>
      <button type="button" class="btn" onclick={add}>Add part</button>
    </div>
  </section>

  <section aria-labelledby="reads-h" class="blk">
    <h3 id="reads-h">What your widget reads</h3>
    {#if reads.length}
      <ul class="reads">
        {#each reads as f (f.id)}
          <li>
            <code>{f.id}</code>
            <span class="tag" class:on={f.served}>{f.served ? 'Served today' : 'Planned'}</span>
            {#if f.auth === 'vault'}<span class="tag">Needs a credential in the vault</span>{/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="small">Nothing. It only shows fixed text.</p>
    {/if}
    <p class="hint">
      Network: none. Files: none. Programs: none. A spec widget cannot ask for more than this.
      {#if reads.some((f) => !f.served)}
        Fields marked Planned are in the registry catalog but the daemon does not serve them yet, so
        the widget can be listed but will only show sample data until it does.
      {/if}
    </p>
  </section>

  <div class="actions">
    <Confirm
      label="Reset layout to the start"
      question="Throw away your layout changes?"
      yes="Reset layout"
      onconfirm={() => {
        store.draft.layout = structuredClone(TEMPLATES[store.draft.template].layout);
        store.style = ROOT;
        note = 'Layout reset.';
      }}
    />
  </div>
  <p class="sr-only" role="status" aria-live="polite">{note}</p>
</div>

<style>
  .shape {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  .blk {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .blk h3:focus {
    outline: none;
  }
  .addstyle,
  .addpart {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px;
  }
  .addstyle .field {
    width: min(100%, 240px);
  }
  .addpart .field {
    width: min(100%, 260px);
  }
  .parts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .part {
    padding: 12px 16px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .phead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
  }
  .phead h4 {
    font-size: var(--fs-3);
  }
  .mv {
    display: flex;
    gap: 6px;
  }
  .pgrid {
    display: grid;
    gap: 14px 16px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  }
  .part > div:last-child:not(.pgrid) {
    margin-top: 10px;
  }
  .reads {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .reads li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
  }
</style>
