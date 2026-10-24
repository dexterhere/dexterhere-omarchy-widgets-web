<script lang="ts">
  import { STEPS, type MakeStore } from './store.svelte';

  let { store, onGo }: { store: MakeStore; onGo: (n: number) => void } = $props();
</script>

<nav aria-label="Progress">
  <ol class="rail">
    {#each STEPS as s (s.n)}
      {@const state = s.n < store.step ? 'done' : s.n === store.step ? 'now' : 'next'}
      <li data-state={state}>
        <button
          type="button"
          aria-current={state === 'now' ? 'step' : undefined}
          onclick={() => onGo(s.n)}
        >
          <span class="n" aria-hidden="true">
            {#if state === 'done'}
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"><path d="M3 8.5l3.2 3L13 4.5" /></svg
              >
            {:else}{s.n}{/if}
          </span>
          <span class="t"
            ><span class="sr-only"
              >Step {s.n}{state === 'done' ? ', done' : ''}:
            </span>{s.title}</span
          >
        </button>
      </li>
    {/each}
  </ol>
  <p class="count small text-2" aria-hidden="true">
    Step {store.step} of 4: {STEPS[store.step - 1].title}
  </p>
</nav>

<style>
  .rail {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
  }
  li {
    position: relative;
    min-width: 0;
  }
  /* The rail: a hairline through the numbers, brand once the step is reached. */
  li::before {
    content: '';
    position: absolute;
    top: 17px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--border-strong);
  }
  li[data-state='done']::before,
  li[data-state='now']::before {
    background: var(--brand);
  }
  li[data-state='now']::before {
    right: 50%;
  }
  button {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 0 8px 0 0;
    background: none;
    border: 0;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .n {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    background: var(--bg);
    border: 2px solid var(--border-strong);
    font-weight: 700;
  }
  li[data-state='done'] .n {
    border-color: var(--brand);
    color: var(--brand);
  }
  li[data-state='now'] .n {
    background: var(--brand);
    border-color: var(--brand);
    color: var(--brand-ink);
  }
  .t {
    font-size: var(--fs-2);
    line-height: 20px;
  }
  li[data-state='now'] .t {
    font-weight: 700;
  }
  li[data-state='next'] .t {
    color: var(--text-2);
  }
  button:hover .t {
    text-decoration: underline;
    text-decoration-color: var(--brand);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }
  .count {
    display: none;
  }
  @media (max-width: 599px) {
    .t {
      display: none;
    }
    .count {
      display: block;
      margin-top: 8px;
    }
  }
</style>
