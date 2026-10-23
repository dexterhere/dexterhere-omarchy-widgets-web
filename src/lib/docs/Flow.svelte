<script lang="ts">
  // A numbered flow diagram made of plain HTML, so it follows the theme, reads in order with a
  // screen reader and needs no image. Text only: nothing here is rendered as HTML.
  export interface FlowStep {
    title: string;
    text?: string;
    /** Who acts: shown as a text badge, never colour-only. */
    who?: string;
  }
  let { steps, label }: { steps: FlowStep[]; label: string } = $props();
</script>

<ol class="flow" aria-label={label}>
  {#each steps as s, i (i)}
    <li>
      <div class="card">
        <p class="head">
          <span class="n">{i + 1}</span>
          <strong>{s.title}</strong>
          {#if s.who}<span class="who">{s.who}</span>{/if}
        </p>
        {#if s.text}<p class="text">{s.text}</p>{/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .flow {
    list-style: none;
    margin: 1.25em 0;
    padding: 0;
    display: grid;
    gap: 0;
    font-family: var(--font-sans);
    font-size: var(--fs-3);
  }
  li {
    position: relative;
    padding-bottom: 20px;
  }
  li:last-child {
    padding-bottom: 0;
  }
  li:not(:last-child)::after {
    content: '\2193';
    position: absolute;
    left: 18px;
    bottom: 0;
    color: var(--text-2);
    font: 700 16px / 20px var(--font-mono);
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border-strong);
    padding: 10px 14px;
  }
  .head {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    max-width: none;
  }
  .n {
    font: 700 var(--fs-2) / 20px var(--font-mono);
    color: var(--text-2);
  }
  .who {
    margin-left: auto;
    font: 600 var(--fs-2) / 18px var(--font-mono);
    border: 1px solid var(--border-strong);
    padding: 0 6px;
    color: var(--text);
  }
  .text {
    margin: 4px 0 0;
    max-width: none;
    color: var(--text-2);
    line-height: 1.5;
  }
</style>
