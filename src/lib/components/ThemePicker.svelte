<script lang="ts">
  import { shortcuts } from '../shortcuts.svelte';
  import { onMount, tick, untrack } from 'svelte';
  import ThemePreview from './ThemePreview.svelte';
  import { theme } from '../themes/store.svelte';
  import { THEMES } from '../themes/themes';
  import { offset, reachFor, slot, swipeStep, wrap } from '../themes/picker';
  import { loadGsap, motion, prefersReducedMotion, type Gsap } from '../motion';

  const n = THEMES.length;
  let dialog = $state<HTMLDialogElement>();
  let stage = $state<HTMLElement>();
  let index = $state(0);
  let ready = $state(false);
  let narrow = $state(false);
  let gsap: Gsap | undefined;

  let reach = $state(8);
  const cards = $derived(THEMES.map((t, i) => ({ t, o: offset(i, index, n) })));
  const active = $derived(THEMES[index]);

  onMount(() => {
    const mq = matchMedia('(max-width: 640px)');
    const set = () => {
      narrow = mq.matches;
      const w = stage?.querySelector<HTMLElement>('.card')?.offsetWidth;
      if (w) reach = reachFor(innerWidth, w);
    };
    set();
    mq.addEventListener('change', set);
    addEventListener('resize', set);
    return () => {
      mq.removeEventListener('change', set);
      removeEventListener('resize', set);
    };
  });

  // Put every card in its slot. Animated moves kill whatever tween is running first and
  // retarget, so rapid key repeats never queue stale tweens. Cards created this render
  // (entering at +-3) are placed instantly.
  function place(animate: boolean) {
    if (!gsap || !stage) return;
    const instant = !animate || prefersReducedMotion();
    for (const el of stage.querySelectorAll<HTMLElement>('.card')) {
      const o = Number(el.dataset.o);
      const s = slot(o, narrow, reach);
      const shade = el.querySelector('.shade');
      const props = {
        x: s.x * el.offsetWidth,
        scaleY: s.scaleY,
        skewX: s.skew,
        opacity: s.hidden ? 0 : 1
      };
      el.style.zIndex = String(s.z);
      el.inert = s.hidden;
      // a card that wraps from one end of the strip to the other jumps instead of sliding across
      const fresh = !el.dataset.placed || Math.abs(o - Number(el.dataset.placed)) > n / 2;
      el.dataset.placed = String(o);
      gsap.killTweensOf([el, shade]);
      if (instant || fresh) {
        gsap.set(el, props);
        gsap.set(shade, { opacity: s.shade });
      } else {
        const to = { duration: motion.base, ease: motion.easeOut };
        gsap.to(el, { ...props, ...to });
        gsap.to(shade, { opacity: s.shade, ...to });
      }
    }
  }

  $effect(() => {
    if (theme.open && dialog && !dialog.open) {
      index = Math.max(
        0,
        THEMES.findIndex((t) => t.id === untrack(() => theme.current))
      );
      dialog.showModal();
      void loadGsap().then(async (g) => {
        gsap = g;
        reach = reachFor(
          innerWidth,
          stage?.querySelector<HTMLElement>('.card')?.offsetWidth ?? 600
        );
        place(false);
        ready = true;
        await tick();
        stage?.querySelector<HTMLElement>('.card[data-o="0"]')?.focus();
      });
    }
  });

  $effect(() => {
    void index;
    void narrow;
    void reach;
    if (!ready) return;
    place(true);
    // Focus follows the highlight so a slab never wears the focus outline.
    void tick().then(() => {
      if (document.activeElement?.closest('.stage'))
        stage?.querySelector<HTMLElement>('.card[data-o="0"]')?.focus({ preventScroll: true });
    });
  });

  const go = (i: number) => (index = wrap(i, n));

  function apply() {
    theme.keep(active.id);
    // a keystroke can land before the effect has opened the dialog: then just cancel the open
    if (dialog?.open) dialog.close();
    else theme.open = false;
  }

  // Fires for apply, Esc and anything else that closes the dialog.
  function onclose() {
    ready = false;
    theme.open = false;
    // the opener can be gone (the hint closes itself when the picker opens): fall back to the header button
    const back = theme.opener?.isConnected
      ? theme.opener
      : document.querySelector<HTMLElement>('[data-theme-trigger]');
    back?.focus();
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
    if (!theme.open) {
      if ((e.key === 't' || e.key === 'T') && shortcuts.on) {
        e.preventDefault();
        theme.openPicker();
      }
      return;
    }
    if (e.key === 'ArrowLeft') go(index - 1);
    else if (e.key === 'ArrowRight') go(index + 1);
    // Enter applies the highlighted theme wherever focus is (the arrow buttons keep their own Enter).
    else if (e.key === 'Enter' && !(e.target as Element).closest?.('.arrow')) apply();
    else return;
    e.preventDefault();
  }

  // Touch and pen: swipe left or right. The click that can follow a drag is swallowed.
  let startX = 0;
  let startY = 0;
  let swiped = false;
  const ondown = (e: PointerEvent) => {
    startX = e.clientX;
    startY = e.clientY;
    swiped = false;
  };
  const onup = (e: PointerEvent) => {
    const step = swipeStep(e.clientX - startX, e.clientY - startY);
    if (step) {
      swiped = true;
      go(index + step);
    }
  };

  function onclick(e: MouseEvent) {
    if (swiped) {
      swiped = false;
      return;
    }
    // The dimmed backdrop (the dialog fills the viewport) and empty space close it.
    if (!(e.target instanceof Element) || !e.target.closest('button')) dialog?.close();
  }
</script>

<svelte:window {onkeydown} />

<dialog
  bind:this={dialog}
  class="picker"
  aria-label="Choose a theme"
  {onclose}
  {onclick}
  onpointerdown={ondown}
  onpointerup={onup}
>
  <div class="stage" class:ready bind:this={stage}>
    {#each cards as { o, t } (t.id)}
      <button
        class="card"
        type="button"
        data-o={o}
        tabindex={o === 0 ? 0 : -1}
        aria-label={o === 0 ? `Apply ${t.name}` : `Show ${t.name}`}
        onclick={() => (o === 0 ? apply() : go(index + o))}
      >
        <ThemePreview id={t.id} />
        <span class="shade"></span>
      </button>
    {/each}
  </div>

  <p class="theme-name" aria-hidden="true">{active.name}</p>
  <p class="sr-only" aria-live="polite" aria-atomic="true">{active.name}</p>

  <button
    class="arrow left"
    type="button"
    aria-label="Previous theme"
    onclick={() => go(index - 1)}
  >
    <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"
      ><path d="M10 2 4 8l6 6" fill="none" stroke="currentColor" stroke-width="2" /></svg
    >
  </button>
  <button class="arrow right" type="button" aria-label="Next theme" onclick={() => go(index + 1)}>
    <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"
      ><path d="m6 2 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" /></svg
    >
  </button>
</dialog>

<style>
  .picker {
    --w: clamp(240px, 40vw, 780px);
    position: fixed;
    inset: 0;
    width: 100vw;
    max-width: none;
    height: 100dvh;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    color: var(--text);
    background: transparent;
    overflow: hidden;
    touch-action: pan-y;
  }
  .picker::backdrop {
    background: color-mix(in srgb, var(--bg-deep) 82%, transparent);
  }
  .picker[open] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
  }
  .stage {
    position: relative;
    width: 100%;
    height: calc(var(--w) * 0.625 + 16px); /* room for the ring */
    overflow: hidden;
    flex: none;
    visibility: hidden;
  }
  .stage.ready {
    visibility: visible;
  }
  .card {
    position: absolute;
    left: 50%;
    top: 6px;
    width: var(--w);
    margin-left: calc(var(--w) / -2);
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    will-change: transform;
    transform-origin: 50% 50%;
  }
  /* The highlighted preview wears the theme's accent, like the one on omarchy.org. */
  .card[data-o='0']::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px solid var(--brand);
    pointer-events: none;
  }
  .shade {
    position: absolute;
    inset: 0;
    background: var(--bg-deep);
    pointer-events: none;
  }
  .theme-name {
    margin: 0;
    max-width: calc(100vw - 112px);
    text-align: center;
    font-size: clamp(28px, 3.4vw, 52px);
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .arrow {
    position: absolute;
    top: 50%;
    width: 48px;
    height: 48px;
    margin-top: -24px;
    display: grid;
    place-items: center;
    padding: 0;
    cursor: pointer;
    color: var(--text);
    background: transparent;
    border: 2px solid var(--text);
    z-index: 200; /* above every card */
  }
  .arrow:hover {
    background: var(--text);
    color: var(--bg);
  }
  .left {
    left: 16px;
  }
  .right {
    right: 16px;
  }
  @media (max-width: 640px) {
    .picker {
      --w: 70vw;
    }
    .arrow {
      width: 40px;
      height: 40px;
      margin-top: -20px;
    }
    .left {
      left: 8px;
    }
    .right {
      right: 8px;
    }
  }
</style>
