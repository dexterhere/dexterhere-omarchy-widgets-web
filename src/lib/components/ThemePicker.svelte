<script lang="ts">
  import ThemePreview from './ThemePreview.svelte';
  import { theme } from '../themes/store.svelte';
  import { THEMES } from '../themes/themes';

  const n = THEMES.length;
  let dialog = $state<HTMLDialogElement>();
  let keepBtn = $state<HTMLButtonElement>();
  let index = $state(0);
  let original = '';
  let kept = false;

  const wrap = (i: number) => ((i % n) + n) % n;
  const offsets = [-3, -2, -1, 0, 1, 2, 3];
  const visible = $derived(offsets.map((o) => ({ o, t: THEMES[wrap(index + o)] })));
  const active = $derived(THEMES[index]);

  $effect(() => {
    if (theme.open && dialog && !dialog.open) {
      original = theme.current;
      kept = false;
      index = Math.max(
        0,
        THEMES.findIndex((t) => t.id === original)
      );
      dialog.showModal();
      keepBtn?.focus();
    }
  });

  function go(i: number) {
    index = wrap(i);
    theme.apply(THEMES[index].id);
  }

  function keep() {
    theme.keep(active.id);
    kept = true;
    dialog?.close();
  }

  // Fires for Keep, Cancel, Esc and anything else that closes the dialog.
  function onclose() {
    theme.open = false;
    if (!kept) theme.apply(original);
    theme.opener?.focus();
    theme.opener = null;
  }

  function typing(t: EventTarget | null) {
    return (
      t instanceof HTMLElement &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    );
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      if (theme.open) go(index + 1);
      else theme.openPicker();
      return;
    }
    if (!theme.open) return;
    const k = e.key;
    if (k === 'ArrowLeft') go(index - 1);
    else if (k === 'ArrowRight') go(index + 1);
    else if (k === 'Home') go(0);
    else if (k === 'End') go(n - 1);
    else if (k === 'Enter') {
      // Real buttons keep their own Enter behaviour (Previous, Next, Cancel, Keep).
      if (e.target instanceof HTMLElement && e.target.closest('.controls, .top')) return;
      keep();
    } else return;
    e.preventDefault();
  }
</script>

<svelte:window {onkeydown} />

<dialog bind:this={dialog} class="picker" aria-labelledby="picker-title" {onclose}>
  <div class="top">
    <h2 id="picker-title" class="title">Choose a theme</h2>
    <button class="btn small" type="button" onclick={() => dialog?.close()}>Cancel</button>
  </div>

  <div class="stage">
    {#each visible as { o, t } (t.id)}
      <button
        class="card"
        type="button"
        data-o={o}
        tabindex="-1"
        aria-label={o === 0 ? `Keep ${t.name}` : `Preview ${t.name}`}
        onclick={() => (o === 0 ? keep() : go(index + o))}
      >
        <ThemePreview id={t.id} />
      </button>
    {/each}
  </div>

  <div class="controls">
    <button
      class="btn icon"
      type="button"
      aria-label="Previous theme"
      onclick={() => go(index - 1)}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"
        ><path d="M10 2 4 8l6 6" fill="none" stroke="currentColor" stroke-width="2" /></svg
      >
    </button>
    <div class="name">
      <p class="theme-name" aria-live="polite" aria-atomic="true">
        <span>{active.name}</span>
        <span class="sr-only">, {index + 1} of {n}</span>
      </p>
      <p class="tiny muted count" aria-hidden="true">{index + 1} of {n}</p>
    </div>
    <button class="btn icon" type="button" aria-label="Next theme" onclick={() => go(index + 1)}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"
        ><path d="m6 2 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" /></svg
      >
    </button>
  </div>

  <div class="keep">
    <button class="btn-primary" type="button" bind:this={keepBtn} onclick={keep}
      >Keep this theme</button
    >
  </div>
  <p class="tiny muted keys">
    <kbd>Left</kbd> <kbd>Right</kbd> choose, <kbd>Enter</kbd> keeps, <kbd>Esc</kbd> closes,
    <kbd>T</kbd> cycles.
  </p>
</dialog>

<style>
  .picker {
    --w: min(62vw, 520px, 56dvh);
    position: fixed;
    inset: 0;
    width: 100vw;
    max-width: none;
    height: 100dvh;
    max-height: none;
    margin: 0;
    padding: 16px;
    border: 0;
    color: var(--text);
    background-color: var(--bg);
    /* the pixel-grid texture lives here and in the preview, nowhere else on the site */
    background-image:
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 24px 24px;
    background-position: center;
    overflow: hidden;
  }
  .picker[open] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
  }
  .top {
    position: absolute;
    top: 16px;
    left: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .title {
    font-size: var(--fs-3);
    line-height: 24px;
  }
  .stage {
    position: relative;
    width: 100%;
    height: calc(var(--w) * 0.625);
    overflow: hidden;
    flex: none;
  }
  .card {
    position: absolute;
    left: 50%;
    top: 0;
    width: var(--w);
    margin-left: calc(var(--w) / -2);
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    transition:
      transform 0.28s cubic-bezier(0.2, 0.7, 0.2, 1),
      opacity 0.28s;
  }
  .card[data-o='0'] {
    z-index: 5;
  }
  .card[data-o='-1'] {
    transform: translateX(-84%) scale(0.62);
    opacity: 0.7;
    z-index: 4;
  }
  .card[data-o='1'] {
    transform: translateX(84%) scale(0.62);
    opacity: 0.7;
    z-index: 4;
  }
  .card[data-o='-2'] {
    transform: translateX(-130%) scale(0.4);
    opacity: 0.4;
    z-index: 3;
  }
  .card[data-o='2'] {
    transform: translateX(130%) scale(0.4);
    opacity: 0.4;
    z-index: 3;
  }
  .card[data-o='-3'],
  .card[data-o='3'] {
    transform: translateX(calc(var(--o-sign, 1) * 150%)) scale(0.3);
    opacity: 0;
    pointer-events: none;
  }
  .card[data-o='-3'] {
    --o-sign: -1;
  }
  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .name {
    min-width: 200px;
    text-align: center;
  }
  .theme-name {
    margin: 0 auto;
    font-size: var(--fs-5);
    line-height: 36px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .count {
    margin: 0 auto;
  }
  .keys {
    margin: 0 auto;
    text-align: center;
  }
  @media (max-width: 480px) {
    .keys {
      display: none;
    }
    .name {
      min-width: 160px;
    }
  }
  @media (max-height: 520px) {
    .keys {
      display: none;
    }
  }
</style>
