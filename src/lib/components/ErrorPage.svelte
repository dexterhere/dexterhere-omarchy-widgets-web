<script lang="ts">
  import { sitePath } from '../site';
  import { REPORT_URL } from '../registry/links';
  import { copyFor, safePathForDisplay } from '../errors';
  import PixelNumber from './PixelNumber.svelte';

  interface Props {
    status: number;
    /** Overrides the default heading for the status (see errors.ts). */
    title?: string;
    /** Overrides the default sentence for the status. */
    message?: string;
    /** Quiet extra line, plain text (for example the error message of a 4xx). */
    detail?: string;
    /** The path that failed. Shown for 4xx only: a 5xx never echoes the address. */
    path?: string;
  }

  let { status, title, message, detail, path }: Props = $props();

  const copy = $derived(copyFor(status));
  const heading = $derived(title ?? copy.title);
  const sentence = $derived(message ?? copy.message);
  const shownPath = $derived(status < 500 && path ? safePathForDisplay(path) : '');
  // SvelteKit's own texts ("Not Found") repeat the heading or sentence: leave those out.
  const shownDetail = $derived(
    detail &&
      !sentence.toLowerCase().startsWith(detail.toLowerCase()) &&
      detail.toLowerCase() !== heading.toLowerCase()
      ? detail
      : ''
  );
  const serverError = $derived(status >= 500);
  // Same pattern as Header.svelte: the links are data built by the site helpers (path or host mode).
  const actions = [
    { href: sitePath('/'), label: 'Go to the home page', primary: true },
    { href: sitePath('/widgets/'), label: 'Browse widgets', primary: false }
  ];
</script>

<!-- Not indexed by the search: an error page is not content. -->
<section class="error" data-pagefind-ignore="all">
  <div class="site-frame">
    <h1 class="num">
      <PixelNumber value={status} />
      <span class="sr-only">{heading}</span>
    </h1>
    <p class="msg">{sentence}</p>
    {#if shownDetail}
      <p class="quiet small">{shownDetail}</p>
    {/if}
    {#if shownPath}
      <p class="quiet small">Address: <code class="path">{shownPath}</code></p>
    {/if}
    <div class="actions">
      {#each actions as a (a.label)}
        <a class={a.primary ? 'btn-primary' : 'btn'} href={a.href}>{a.label}</a>
      {/each}
    </div>
    {#if serverError}
      <p class="small report"><a href={REPORT_URL}>Report the problem</a></p>
    {/if}
  </div>
</section>

<style>
  .error {
    padding-block: 48px 64px;
  }
  /* The pixel number is the heading; its name is the status plus the visually hidden title. */
  .num {
    margin: 0;
    font-size: var(--fs-3);
    line-height: normal;
    font-weight: 400;
  }
  .msg {
    margin-top: 24px;
    font-size: var(--fs-3);
    line-height: 24px;
    max-width: 52ch;
  }
  .quiet {
    margin-top: 12px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .path {
    font-size: var(--fs-1);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 32px;
  }
  .report {
    margin-top: 24px;
  }
  @media (max-width: 359px) {
    .actions a {
      width: 100%;
    }
  }
</style>
