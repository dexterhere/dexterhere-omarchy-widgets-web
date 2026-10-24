<script lang="ts">
  import { tick } from 'svelte';

  // A button that asks before doing something that loses work. Inline, not a browser dialog:
  // it can be styled, tested, and read by a screen reader. Escape and "Keep it" cancel.
  let {
    label,
    question,
    yes,
    onconfirm,
    small = true
  }: {
    label: string;
    question: string;
    yes: string;
    onconfirm: () => void;
    small?: boolean;
  } = $props();
  let asking = $state(false);
  let keep: HTMLButtonElement | undefined = $state();
  let ask: HTMLButtonElement | undefined = $state();

  async function open() {
    asking = true;
    await tick();
    keep?.focus();
  }
  async function close() {
    asking = false;
    await tick();
    ask?.focus();
  }
</script>

{#if asking}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="ask"
    role="group"
    aria-label={question}
    onkeydown={(e) => e.key === 'Escape' && close()}
  >
    <span class="small">{question}</span>
    <button type="button" class="btn" class:small bind:this={keep} onclick={close}>Keep it</button>
    <button
      type="button"
      class="btn"
      class:small
      onclick={() => {
        asking = false;
        onconfirm();
      }}>{yes}</button
    >
  </div>
{:else}
  <button type="button" class="btn" class:small bind:this={ask} onclick={open}>{label}</button>
{/if}

<style>
  .ask {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 6px 8px 6px 12px;
    border: 1px solid var(--brand);
    background: var(--surface);
  }
</style>
