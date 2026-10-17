<script lang="ts">
  import { onMount } from 'svelte';
  import { prefersReducedMotion } from '../motion';

  // A btop-like monitor. Every number is sample data from a seeded generator. It animates once a
  // second, and stops under reduced motion and while the tab is hidden.
  let cpu = $state([34, 52, 21, 67, 40, 18, 73, 29]);
  let mem = $state(41);
  let net = $state([12, 18, 9, 22, 30, 14, 8, 26, 33, 19, 11, 24]);
  let seed = 1234;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const PROCS = [
    ['hyprland', 3.1, 212],
    ['ow-host', 1.4, 96],
    ['ghostty', 0.9, 143],
    ['btop', 0.6, 22],
    ['pipewire', 0.3, 31]
  ] as const;

  function tick() {
    cpu = cpu.map((v) => Math.max(4, Math.min(96, v + (rnd() - 0.5) * 40)));
    mem = Math.max(30, Math.min(70, mem + (rnd() - 0.5) * 4));
    net = [...net.slice(1), Math.round(rnd() * 40)];
  }

  onMount(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => {
      if (!document.hidden) tick();
    }, 1000);
    return () => clearInterval(id);
  });
  const peak = $derived(Math.max(...net, 1));
</script>

<div class="mon">
  <div class="note">sample data, not your machine</div>
  <div class="cols">
    <div class="box">
      <div class="h">cpu</div>
      {#each cpu as v, i (i)}
        <div class="row">
          <span class="k">c{i}</span>
          <span class="track"><span class="fill" style:width="{v}%"></span></span>
          <span class="v">{Math.round(v)}%</span>
        </div>
      {/each}
    </div>
    <div class="box">
      <div class="h">mem</div>
      <div class="row">
        <span class="k">used</span>
        <span class="track"><span class="fill alt" style:width="{mem}%"></span></span>
        <span class="v">{Math.round(mem)}%</span>
      </div>
      <div class="h net">net</div>
      <div class="spark" aria-hidden="true">
        {#each net as v, i (i)}<span style:height="{(v / peak) * 100}%"></span>{/each}
      </div>
      <div class="h net">proc</div>
      {#each PROCS as p (p[0])}
        <div class="proc"><span>{p[0]}</span><span>{p[1]}%</span></div>
      {/each}
    </div>
  </div>
</div>

<style>
  .mon {
    height: 100%;
    overflow: hidden;
    padding: 4px 6px;
    font: 400 11px / 14px var(--font-mono);
    color: var(--text-2);
  }
  .note {
    color: var(--muted);
    margin-bottom: 2px;
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .box {
    border: 1px solid var(--border-strong);
    padding: 2px 5px 4px;
    min-width: 0;
  }
  .h {
    color: var(--text);
    font-weight: 700;
  }
  .h.net {
    margin-top: 4px;
  }
  .row {
    display: grid;
    grid-template-columns: 30px 1fr 30px;
    gap: 4px;
    align-items: center;
  }
  .track {
    height: 6px;
    background: var(--surface-2);
    display: block;
  }
  .fill {
    display: block;
    height: 100%;
    background: var(--brand);
  }
  .fill.alt {
    background: var(--text-2);
  }
  .v {
    text-align: right;
  }
  .spark {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 26px;
  }
  .spark span {
    flex: 1;
    background: var(--text-2);
    min-height: 1px;
  }
  .proc {
    display: flex;
    justify-content: space-between;
  }
</style>
