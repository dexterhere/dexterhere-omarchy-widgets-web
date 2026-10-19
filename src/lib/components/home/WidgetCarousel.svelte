<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { resolve } from '$app/paths';
  import { getStatsProvider, type Stats } from '../../stats';
  import { edges, normalizeStarts, pageTarget, settleTarget, stepTarget } from '../../carousel';
  import { loadGsap, motion, prefersReducedMotion } from '../../motion';
  import { categoryLabels, type Category, type RegistryWidget } from '../../registry';
  import Card from '../gallery/WidgetCard.svelte';

  // A native scroll-snap track with real buttons, arrow keys, mouse drag and a GSAP smooth
  // scroll (instant under reduced motion). No autoplay. Touch scrolls natively.
  let { widgets, onTry }: { widgets: RegistryWidget[]; onTry?: (id: string) => void } = $props();

  let cat = $state<Category | 'all'>('all');
  let stats = $state<Record<string, Stats | null>>({});
  const cats = $derived(
    (Object.keys(categoryLabels) as Category[])
      .map((c) => ({ c, n: widgets.filter((w) => w.categories.includes(c)).length }))
      .filter((x) => x.n > 0)
  );
  const shown = $derived(
    cat === 'all' ? widgets : widgets.filter((w) => w.categories.includes(cat as Category))
  );

  let track: HTMLUListElement;
  let prev: HTMLButtonElement;
  let next: HTMLButtonElement;
  let atStart = $state(true);
  let atEnd = $state(false);
  let moving = $state(false);
  let dragging = $state(false);
  let starts: number[] = [];
  let step = 300;

  function measure() {
    if (!track) return;
    const items = [...track.children] as HTMLElement[];
    const max = track.scrollWidth - track.clientWidth;
    starts = normalizeStarts(
      items.map((li) => li.offsetLeft),
      max
    );
    step =
      items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : (items[0]?.offsetWidth ?? 300);
    const e = edges(track.scrollLeft, track.scrollWidth, track.clientWidth);
    atStart = e.atStart;
    atEnd = e.atEnd;
    // A button that just became disabled must not leave focus on nothing.
    void tick().then(() => {
      const a = document.activeElement;
      if (a === prev && atStart) (atEnd ? track : next).focus();
      else if (a === next && atEnd) (atStart ? track : prev).focus();
    });
  }

  let raf = 0;
  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(measure);
  };

  let tween: { kill: () => void } | undefined;
  async function scrollTo(x: number) {
    tween?.kill();
    moving = false;
    if (prefersReducedMotion()) {
      track.scrollLeft = x;
      return;
    }
    const gsap = await loadGsap();
    const o = { v: track.scrollLeft };
    // Scroll snapping would fight each frame of the tween: switch it off until the end.
    moving = true;
    tween = gsap.to(o, {
      v: x,
      duration: motion.slow,
      ease: motion.easeInOut,
      onUpdate: () => (track.scrollLeft = o.v),
      onComplete: () => (moving = false)
    });
  }

  const page = (dir: 1 | -1) =>
    void scrollTo(pageTarget(starts, track.scrollLeft, track.clientWidth, step, dir));

  function onKey(e: KeyboardEvent) {
    if (e.target !== track || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      void scrollTo(stepTarget(starts, track.scrollLeft, e.key === 'ArrowRight' ? 1 : -1));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      void scrollTo(e.key === 'Home' ? 0 : (starts.at(-1) ?? 0));
    }
  }

  // Mouse and pen drag. Touch uses native scrolling.
  let drag: {
    x: number;
    left: number;
    t: number;
    v: number;
    lastX: number;
    moved: boolean;
  } | null = null;
  let suppressClick = false;
  function down(e: PointerEvent) {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    drag = {
      x: e.clientX,
      left: track.scrollLeft,
      t: performance.now(),
      v: 0,
      lastX: e.clientX,
      moved: false
    };
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true;
      tween?.kill();
      track.setPointerCapture(e.pointerId);
      dragging = true;
    }
    const now = performance.now();
    const dt = Math.max(1, now - drag.t);
    drag.v = 0.8 * drag.v + 0.2 * ((e.clientX - drag.lastX) / dt);
    drag.lastX = e.clientX;
    drag.t = now;
    track.scrollLeft = drag.left - dx;
  }
  function up() {
    const d = drag;
    drag = null;
    if (!d?.moved) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    dragging = false;
    void scrollTo(settleTarget(starts, track.scrollLeft, d.v));
  }
  function clickCapture(e: MouseEvent) {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  onMount(() => {
    getStatsProvider()
      .getStats(widgets.map((w) => w.id))
      .then((r) => (stats = r))
      .catch(() => {});
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      tween?.kill();
    };
  });

  // Filtering: back to the first card, then re-measure.
  function pick(c: Category | 'all') {
    cat = c;
    tween?.kill();
    void tick().then(() => {
      track.scrollLeft = 0;
      measure();
    });
  }
</script>

<div class="carousel" role="region" aria-roledescription="carousel" aria-label="Widget carousel">
  <div class="top">
    <div class="chips" role="group" aria-label="Filter by category">
      <button type="button" class="chip" aria-pressed={cat === 'all'} onclick={() => pick('all')}>
        All <span class="n">{widgets.length}</span>
      </button>
      {#each cats as x (x.c)}
        <button type="button" class="chip" aria-pressed={cat === x.c} onclick={() => pick(x.c)}>
          {categoryLabels[x.c]} <span class="n">{x.n}</span>
        </button>
      {/each}
    </div>
    <div class="nav">
      <a class="all" href={resolve('/widgets')}>View all widgets</a>
      <button
        bind:this={prev}
        type="button"
        class="btn icon"
        aria-label="Previous widgets"
        disabled={atStart}
        onclick={() => page(-1)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"
          ><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" /></svg
        >
      </button>
      <button
        bind:this={next}
        type="button"
        class="btn icon"
        aria-label="Next widgets"
        disabled={atEnd}
        onclick={() => page(1)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"
          ><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" /></svg
        >
      </button>
    </div>
  </div>

  <p class="sr-only" role="status" aria-live="polite">
    Showing {shown.length} of {widgets.length} widgets
  </p>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <ul
    bind:this={track}
    class="track"
    tabindex="0"
    aria-label="Widget cards. Left and right arrow keys scroll."
    data-carousel-track
    data-moving={moving ? 'true' : undefined}
    data-drag={dragging ? 'true' : undefined}
    onscroll={onScroll}
    onkeydown={onKey}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    onclickcapture={clickCapture}
    ondragstart={(e) => e.preventDefault()}
  >
    {#each shown as w, i (w.id)}
      <li
        class="slide"
        aria-label="{w.name}, {i + 1} of {shown.length}"
        data-slide
        data-widget-card={w.id}
      >
        <Card widget={w} variant="carousel" {onTry} stats={stats[w.id] ?? null} />
      </li>
    {/each}
  </ul>
</div>

<style>
  .carousel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }
  .chip {
    display: inline-flex;
    gap: 8px;
    min-height: 32px;
    align-items: center;
    padding: 0 12px;
    font: 400 var(--fs-2) / 20px var(--font-mono);
    color: var(--text);
    background: transparent;
    border: 1px solid var(--border-strong);
    cursor: pointer;
  }
  .chip:hover {
    border-color: var(--text-2);
  }
  .chip[aria-pressed='true'] {
    background: var(--brand);
    border-color: var(--brand);
    color: var(--brand-ink);
  }
  .n {
    opacity: 0.8;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
  .all {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    margin-right: 8px;
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn:disabled:hover {
    background: transparent;
    border-color: var(--border-strong);
  }
  .track {
    position: relative;
    display: flex;
    gap: 16px;
    margin: 0;
    padding: 0 0 8px;
    list-style: none;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
    cursor: grab;
  }
  .track[data-moving='true'],
  .track[data-drag='true'] {
    scroll-snap-type: none;
  }
  .track[data-drag='true'] {
    cursor: grabbing;
    user-select: none;
  }
  .slide {
    flex: 0 0 clamp(280px, 30%, 420px);
    scroll-snap-align: start;
    min-width: 0;
  }
  @media (max-width: 719px) {
    .slide {
      flex-basis: 82%;
    }
  }
</style>
