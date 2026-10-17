<script lang="ts">
  import { page } from '$app/state';

  let { toc }: { toc: { id: string; text: string; depth: 2 | 3 }[] } = $props();
  let activeId = $state('');
  let frame = 0;

  // One passive scroll listener, at most one measurement per frame: the current section is the
  // last heading whose top has passed the sticky header area. No observers, no layout thrash.
  function update() {
    frame = 0;
    let found = '';
    for (const t of toc) {
      const el = document.getElementById(t.id);
      if (el && el.getBoundingClientRect().top <= 120) found = t.id;
      else if (el) break;
    }
    activeId = found;
  }
  function onscroll() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  $effect(() => {
    void page.url.pathname;
    void toc;
    update();
  });
</script>

<svelte:window {onscroll} />

{#if toc.length}
  <nav aria-label="On this page">
    <p class="head">On this page</p>
    <ul>
      {#each toc as t (t.id)}
        <li class:sub={t.depth === 3}>
          <a href="#{t.id}" aria-current={t.id === activeId ? 'location' : undefined}>{t.text}</a>
        </li>
      {/each}
    </ul>
  </nav>
{/if}

<style>
  .head {
    margin-bottom: 8px;
    font-weight: 700;
    font-size: var(--fs-2);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border-left: 1px solid var(--border);
  }
  a {
    display: block;
    padding: 3px 12px;
    margin-left: -1px;
    border-left: 2px solid transparent;
    color: var(--muted);
    text-decoration: none;
    font-size: var(--fs-1);
    line-height: 18px;
  }
  .sub a {
    padding-left: 24px;
  }
  a:hover {
    color: var(--text);
  }
  a[aria-current='location'] {
    color: var(--text);
    border-left-color: var(--brand);
  }
</style>
