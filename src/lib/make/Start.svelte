<script lang="ts">
  import { CATEGORIES, LICENSES, type CategoryId, type LicenseId } from './catalog';
  import { idOf, slugOf, DESC_MAX, NAME_MAX, SLUG_MAX } from './draft';
  import { servedState } from './edit';
  import { NEEDS_PROVIDER, TEMPLATES, TEMPLATE_IDS, type TemplateId } from './templates';
  import type { MakeStore } from './store.svelte';

  let { store }: { store: MakeStore } = $props();
  const d = $derived(store.draft);
  let seen = $state<Record<string, boolean>>({});
  const show = (k: keyof typeof store.errors) => (seen[k] || store.showErrors) && store.errors[k];
  const mark = (k: string) => () => (seen[k] = true);

  // What each template needs from the daemon, said plainly. Computed from the layout, not typed.
  function runs(t: TemplateId) {
    const l = TEMPLATES[t].layout;
    const all = [l.root, ...Object.values(l.variants ?? {})].map(servedState);
    if (all.every((s) => s === 'served')) return 'Reads only data the daemon serves today.';
    if (servedState(l.root) === 'served')
      return 'The default layout reads data the daemon serves today. One style needs data it does not serve yet.';
    return 'Reads data the daemon does not serve yet. It runs in the web preview with sample data.';
  }
  const slugValue = $derived(d.slugTouched ? d.slug : slugOf(d));
  const modified = $derived(
    JSON.stringify(d.layout) !== JSON.stringify(TEMPLATES[d.template].layout)
  );
  const idText = $derived(
    store.errors.user || store.errors.slug ? `io.github.<username>.<name>` : idOf(d)
  );
</script>

<div class="start">
  <fieldset class="tpl">
    <legend>Start from</legend>
    <p class="hint" id="tpl-hint">
      Copy a real widget and change it, or start with a blank one. Only widgets whose data exists in
      the registry can be copied.
    </p>
    <div class="cards">
      {#each TEMPLATE_IDS as t (t)}
        {@const T = TEMPLATES[t]}
        <label class="card" class:on={d.template === t}>
          <input
            type="radio"
            name="template"
            value={t}
            checked={d.template === t}
            onchange={() => store.pick(t)}
            aria-describedby="tpl-{t}"
          />
          <span class="ct">{T.label}</span>
          <span class="small text-2" id="tpl-{t}">
            {T.blurb}
            <span class="tiny muted">{runs(t)}</span>
          </span>
        </label>
      {/each}
    </div>
    {#if modified}
      <p class="tiny muted" role="status">
        You changed the layout in step 2. Picking a different start replaces those changes.
      </p>
    {/if}
    <details class="others">
      <summary>Why are GitHub activity, Docker, Tasks and AI usage not here?</summary>
      <p class="small text-2">
        They read data from providers that do not exist yet: {NEEDS_PROVIDER.map(
          (n) => `${n.label} (${n.provider})`
        ).join(', ')}. You can still make a widget with the data that exists, or describe your idea
        and list it later.
      </p>
    </details>
  </fieldset>

  <div class="grid2">
    <div class="field">
      <label for="m-name">Widget name</label>
      <input
        id="m-name"
        type="text"
        autocomplete="off"
        spellcheck="false"
        maxlength={NAME_MAX * 2}
        placeholder={TEMPLATES[d.template].suggest}
        value={d.name}
        oninput={(e) => store.setName(e.currentTarget.value)}
        onblur={mark('name')}
        aria-invalid={show('name') ? 'true' : undefined}
        aria-describedby="m-name-h {show('name') ? 'm-name-e' : ''}"
      />
      <p class="hint" id="m-name-h">
        Shown in the gallery. Up to {NAME_MAX} characters, plain text.
      </p>
      {#if show('name')}<p class="err" id="m-name-e">{store.errors.name}</p>{/if}
    </div>

    <div class="field">
      <label for="m-user">Your GitHub username</label>
      <input
        id="m-user"
        type="text"
        autocomplete="username"
        autocapitalize="off"
        spellcheck="false"
        maxlength="60"
        placeholder="octocat"
        bind:value={store.draft.user}
        onblur={mark('user')}
        aria-invalid={show('user') ? 'true' : undefined}
        aria-describedby="m-user-h {show('user') ? 'm-user-e' : ''}"
      />
      <p class="hint" id="m-user-h">
        Your widget's id is <code>io.github.&lt;username&gt;.&lt;name&gt;</code>. The registry only
        accepts an id from the GitHub account that opens the listing, so people know who made it.
        Your username is already public. Nothing you type here leaves your browser.
      </p>
      {#if show('user')}<p class="err" id="m-user-e">{store.errors.user}</p>{/if}
    </div>

    <div class="field wide">
      <label for="m-desc">One line about it</label>
      <input
        id="m-desc"
        type="text"
        autocomplete="off"
        maxlength={DESC_MAX * 2}
        placeholder="Shows how busy my processor is."
        bind:value={store.draft.description}
        onblur={mark('description')}
        aria-invalid={show('description') ? 'true' : undefined}
        aria-describedby="m-desc-h {show('description') ? 'm-desc-e' : ''}"
      />
      <p class="hint" id="m-desc-h">
        Up to {DESC_MAX} characters ({[...d.description.replace(/\s+/g, ' ').trim()].length} so far).
        It becomes the summary in the gallery.
      </p>
      {#if show('description')}<p class="err" id="m-desc-e">{store.errors.description}</p>{/if}
    </div>

    <div class="field">
      <label for="m-cat">Category</label>
      <select id="m-cat" bind:value={store.draft.category}>
        {#each CATEGORIES as [id, label] (id)}
          <option value={id as CategoryId}>{label}</option>
        {/each}
      </select>
      <p class="hint">Where it is listed in the gallery.</p>
    </div>

    <div class="field">
      <label for="m-lic">License</label>
      <select id="m-lic" bind:value={store.draft.license}>
        {#each LICENSES as l (l)}
          <option value={l as LicenseId}>{l}{l === 'MIT' ? ' (suggested)' : ''}</option>
        {/each}
      </select>
      <p class="hint">
        A license says what others may do with your widget. MIT lets anyone use and change it if
        they keep your name on it. These are the licenses the registry accepts.
      </p>
    </div>
  </div>

  <div class="idbox" aria-live="polite">
    <p class="small text-2">Your widget's id</p>
    <p class="id"><code data-testid="widget-id">{idText}</code></p>
    {#if show('slug')}<p class="err">{store.errors.slug}</p>{/if}
    <details>
      <summary>Change the end of the id or the copyright name</summary>
      <div class="more">
        <div class="field">
          <label for="m-slug">End of the id</label>
          <input
            id="m-slug"
            type="text"
            autocomplete="off"
            spellcheck="false"
            maxlength={SLUG_MAX * 2}
            value={slugValue}
            oninput={(e) => store.setSlug(e.currentTarget.value)}
            aria-invalid={store.errors.slug ? 'true' : undefined}
            aria-describedby="m-slug-h"
          />
          <p class="hint" id="m-slug-h">
            Lowercase letters a-z, numbers and hyphens, up to {SLUG_MAX}. It follows the name until
            you edit it. An id never starts with <code>omarchy.</code>
          </p>
          {#if d.slugTouched}
            <button type="button" class="btn small" onclick={() => store.followName()}>
              Follow the name again
            </button>
          {/if}
        </div>
        <div class="field">
          <label for="m-holder">Name on the license (optional)</label>
          <input
            id="m-holder"
            type="text"
            autocomplete="name"
            maxlength="160"
            placeholder="Your GitHub username"
            bind:value={store.draft.holder}
            aria-invalid={store.errors.holder ? 'true' : undefined}
            aria-describedby="m-holder-h"
          />
          <p class="hint" id="m-holder-h">
            The copyright line reads "Copyright (c) {new Date().getFullYear()} ..." Leave it empty to
            use your username.
          </p>
          {#if store.errors.holder}<p class="err">{store.errors.holder}</p>{/if}
        </div>
      </div>
    </details>
  </div>
</div>

<style>
  .start {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  .tpl {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cards {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 16px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    cursor: pointer;
  }
  .card.on {
    border-color: var(--brand);
    box-shadow: inset 4px 0 0 var(--brand);
  }
  .card input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .card:has(input:focus-visible) {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .ct {
    font-weight: 700;
  }
  .others summary {
    cursor: pointer;
    font-size: var(--fs-2);
  }
  .others p {
    margin-top: 8px;
  }
  .grid2 {
    display: grid;
    gap: 24px 32px;
    grid-template-columns: minmax(0, 1fr);
  }
  @media (min-width: 760px) {
    .grid2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .wide {
      grid-column: 1 / -1;
    }
  }
  .idbox {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 16px;
    border: 1px dashed var(--border-strong);
  }
  .id code {
    font-size: var(--fs-3);
    word-break: break-all;
    overflow-wrap: anywhere;
  }
  .idbox summary {
    cursor: pointer;
    font-size: var(--fs-2);
  }
  .more {
    display: grid;
    gap: 20px;
    margin-top: 12px;
    max-width: 520px;
  }
</style>
