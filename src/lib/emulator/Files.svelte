<script lang="ts">
  const ROWS = [
    ['Documents', 'dir', '12 items'],
    ['Downloads', 'dir', '4 items'],
    ['Pictures', 'dir', '31 items'],
    ['projects', 'dir', '7 items'],
    ['notes.md', 'file', '2.4 KiB'],
    ['todo.txt', 'file', '318 B'],
    ['sample.png', 'file', '88 KiB']
  ];
  let sel = $state(0);
</script>

<div class="files">
  <div class="path">~/Documents (sample files)</div>
  <ul>
    {#each ROWS as r, i (r[0])}
      <li>
        <button type="button" class:sel={sel === i} onclick={() => (sel = i)}>
          <span class="n">{r[1] === 'dir' ? r[0] + '/' : r[0]}</span>
          <span class="s">{r[2]}</span>
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .files {
    height: 100%;
    overflow: auto;
    font: 400 12px / 16px var(--font-mono);
    color: var(--text-2);
  }
  .path {
    padding: 4px 8px;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 2px 0;
  }
  button {
    all: unset;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 1px 8px;
    cursor: default;
    color: var(--text);
  }
  button:focus-visible {
    outline: 1px solid var(--brand);
    outline-offset: -1px;
  }
  button.sel {
    background: var(--brand-soft);
  }
  .s {
    color: var(--muted);
  }
  .sel .s {
    color: var(--text-2);
  }
</style>
