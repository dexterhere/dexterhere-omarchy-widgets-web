<script lang="ts">
  let { text, label = 'Copy' }: { text: string; label?: string } = $props();

  type Status = 'idle' | 'copied' | 'failed';
  let status = $state<Status>('idle');
  let timer: ReturnType<typeof setTimeout> | undefined;

  const message = $derived(
    status === 'copied'
      ? 'Copied'
      : status === 'failed'
        ? 'Copy failed, select the text manually'
        : ''
  );

  // Last resort for browsers without the async clipboard API (or where it is blocked).
  function copyWithExecCommand(value: string): boolean {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }

  async function copy() {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = copyWithExecCommand(text);

    status = ok ? 'copied' : 'failed';
    clearTimeout(timer);
    timer = setTimeout(() => (status = 'idle'), 2000);
  }

  $effect(() => () => clearTimeout(timer));
</script>

<div class="copy">
  <button class="btn small" type="button" onclick={copy}>{label}</button>
  <span class="status small" class:failed={status === 'failed'} aria-live="polite">{message}</span>
</div>

<style>
  .copy {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .status {
    min-height: 20px;
    color: var(--text-2);
  }
  .status.failed {
    color: var(--text);
    text-decoration: underline;
    text-decoration-color: var(--brand);
    text-decoration-thickness: 2px;
  }
</style>
