<script lang="ts">
  import { tick } from 'svelte';
  import { FASTFETCH, runCommand } from './terminal';

  let { label = 'Terminal' }: { label?: string } = $props();

  let lines = $state<string[]>([...FASTFETCH]);
  let value = $state('');
  let box: HTMLElement | undefined;

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const out = runCommand(value);
    const echo = `user@omarchy:~$ ${value}`;
    value = '';
    if (out === 'clear') lines = [];
    else lines = [...lines, echo, ...out].slice(-200);
    await tick();
    if (box) box.scrollTop = box.scrollHeight;
  }
</script>

<div class="term">
  <div class="out" bind:this={box} role="log" aria-label="{label} output (sample)">
    {#each lines as l, i (i)}<div class="line">{l || ' '}</div>{/each}
  </div>
  <form onsubmit={submit} class="prompt">
    <span class="ps1" aria-hidden="true">user@omarchy:~$</span>
    <input
      type="text"
      bind:value
      aria-label="{label} command (emulated). Try help"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />
  </form>
</div>

<style>
  .term {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    font: 400 12px / 16px var(--font-mono);
    color: var(--text);
  }
  .out {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 6px 8px 0;
  }
  .line {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .line:first-child {
    color: var(--text);
    font-weight: 700;
  }
  .prompt {
    display: flex;
    gap: 6px;
    padding: 2px 8px 6px;
  }
  .ps1 {
    color: var(--text);
    font-weight: 700;
    white-space: nowrap;
  }
  input {
    flex: 1;
    min-width: 0;
    all: unset;
    flex: 1 1 0;
    color: var(--text);
    caret-color: var(--text);
    font-weight: 700;
    font: inherit;
  }
  input:focus-visible {
    outline: 1px solid var(--brand);
    outline-offset: 2px;
  }
</style>
