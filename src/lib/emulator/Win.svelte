<script lang="ts">
  import Files from './Files.svelte';
  import { enter } from './fx';
  import Icon from './Icon.svelte';
  import Monitor from './Monitor.svelte';
  import type { EmulatorState, WinInfo } from './state.svelte';
  import type { Rect } from './tiling';
  import Terminal from './Terminal.svelte';

  let {
    emu,
    info,
    rect,
    animate,
    hidden = false
  }: {
    emu: EmulatorState;
    info: WinInfo;
    rect: Rect;
    animate: boolean;
    hidden?: boolean;
  } = $props();

  const focused = $derived(emu.focusedId === info.id);
  const floating = $derived(emu.current.floating.includes(info.id));
</script>

<section
  class="win"
  class:focused
  class:floating
  class:hidden
  data-win={info.id}
  data-kind={info.kind}
  aria-label={info.title}
  style:left="{rect.x}px"
  style:top="{rect.y}px"
  style:width="{rect.w}px"
  style:height="{rect.h}px"
  onpointerdown={() => emu.focus(info.id)}
  use:enter={animate}
>
  <header>
    <span class="t">{info.title}</span>
    <button
      type="button"
      class="x"
      aria-label="Close {info.title}"
      onclick={() => emu.close(info.id)}
    >
      <Icon name="close" size={10} />
    </button>
  </header>
  <div class="body">
    {#if info.kind === 'terminal'}
      <Terminal label={info.title} />
    {:else if info.kind === 'monitor'}
      <Monitor />
    {:else}
      <Files />
    {/if}
  </div>
</section>

<style>
  .win {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
    border: 2px solid var(--border-strong);
    border-radius: 0;
    will-change: left, top, width, height;
  }
  @media (prefers-reduced-motion: no-preference) {
    .win {
      transition:
        left 0.18s ease-out,
        top 0.18s ease-out,
        width 0.18s ease-out,
        height 0.18s ease-out;
    }
    :global(.flipping) .win {
      transition: none;
    }
  }
  .win.focused {
    border-color: var(--brand);
  }
  .win.floating {
    z-index: 5;
  }
  .win.hidden {
    visibility: hidden;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 18px;
    flex: none;
    padding: 0 2px 0 6px;
    background: var(--bg-deep);
    color: var(--text-2);
    font: 400 11px / 18px var(--font-mono);
    border-bottom: 1px solid var(--border);
  }
  .focused header {
    color: var(--text);
  }
  .t {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .x {
    all: unset;
    box-sizing: border-box;
    width: 18px;
    height: 16px;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-2);
  }
  .x:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .x:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: -2px;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
