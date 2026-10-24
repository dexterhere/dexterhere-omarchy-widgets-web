<script lang="ts">
  import Code from './Code.svelte';
  import CopyButton from '../components/CopyButton.svelte';
  import { buildFiles, fileList, zipName } from './files';
  import { runChecks, type CheckItem } from './check';
  import { idOf } from './draft';
  import { listingOf } from './publish';
  import { zip } from './zip';
  import type { MakeStore } from './store.svelte';

  let { store, onGo }: { store: MakeStore; onGo: (n: number) => void } = $props();
  const year = new Date().getFullYear();
  const d = $derived(store.draft);
  const f = $derived(buildFiles(d, year));
  const list = $derived(fileList(d, year));
  // The listing is checked with a stand-in hash: the real one only exists after step 4.
  const check = $derived(
    runChecks({
      manifest: f.manifest,
      widget: f.widget,
      layout: f.layout,
      listing: listingOf(d, '0'.repeat(40))
    })
  );
  const fix = (i: CheckItem) => (i.id === 'layout' || i.id === 'data' ? 2 : 1);

  function save(name: string, data: BlobPart, type: string) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  let said = $state('');
  const downloadOne = (name: string, text: string) => {
    save(name, text, 'text/plain;charset=utf-8');
    said = `Downloaded ${name}.`;
  };
  const downloadAll = () => {
    save(zipName(d), zip(list) as BlobPart, 'application/zip');
    said = `Downloaded ${zipName(d)} with ${list.length} files.`;
  };
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external GitHub and tool links, and in-page anchors -->

<div class="files">
  <section class="callout" aria-labelledby="chk-h" data-testid="check-panel">
    <h3 id="chk-h">Check</h3>
    <p class="small text-2">
      These are the registry's own checks, run here on the files below. Nothing is uploaded.
    </p>
    <p class="verdict" role="status" data-ready={check.ready}>
      {#if check.ready}
        <strong>Ready.</strong> Every file passes.
      {:else}
        <strong>Not ready.</strong> {check.problems} thing{check.problems === 1 ? '' : 's'} to fix.
      {/if}
    </p>
    <ul class="items">
      {#each check.items as i (i.id)}
        <li>
          <span class="tag" class:on={!i.problems.length}
            >{i.problems.length ? 'Fix' : 'Passes'}</span
          >
          <span class="lbl">{i.label}</span>
          {#if i.problems.length}
            <ul class="why">
              {#each i.problems as p, pi (pi)}<li>{p}</li>{/each}
            </ul>
            <button type="button" class="btn small" onclick={() => onGo(fix(i))}>
              Go to step {fix(i)} to fix it
            </button>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="tiny muted">
      The registry also checks that your repository is public, that the commit is on its default
      branch and that GitHub recognises your LICENSE. It does that after you publish, in step 4.
    </p>
  </section>

  <div class="actions">
    <button type="button" class="btn-primary" onclick={downloadAll} data-testid="download-all">
      Download all ({list.length} files, .zip)
    </button>
    <span class="small text-2">Or copy or download each file below.</span>
  </div>
  <p class="sr-only" role="status" aria-live="polite">{said}</p>

  {#each list as file (file.name)}
    <section class="file" aria-labelledby="f-{file.name}" data-file={file.name}>
      <div class="fhead">
        <h3 id="f-{file.name}"><code>{file.name}</code></h3>
        <div class="actions">
          <CopyButton text={file.text} label="Copy {file.name}" />
          <button type="button" class="btn small" onclick={() => downloadOne(file.name, file.text)}>
            Download {file.name}
          </button>
        </div>
      </div>
      <Code text={file.text} label="Contents of {file.name}" />
    </section>
  {/each}

  {#if f.license.kind === 'fetch'}
    <section class="file" aria-labelledby="f-license">
      <h3 id="f-license"><code>LICENSE</code></h3>
      <p class="small">
        {d.license} is a long license, and GitHub only recognises the official text. In step 4 the commands
        download it for you. To do it by hand, save this page as <code>LICENSE</code>:
        <a href={f.license.url} rel="noopener noreferrer">{f.license.url}</a>.
      </p>
      <div class="actions">
        <CopyButton text={f.license.command} label="Copy the download command" />
      </div>
      <Code text={f.license.command} label="License download command" />
    </section>
  {/if}

  <p class="small text-2">
    The id is <code>{idOf(d)}</code>. Put these files at the top level of a new public repository
    (no sub-folders). Next you will do that, step by step.
  </p>
</div>

<style>
  .files {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .verdict {
    font-size: var(--fs-3);
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .items > li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
  }
  .lbl {
    font-size: var(--fs-2);
  }
  .why {
    flex-basis: 100%;
    margin: 0;
    padding-left: 24px;
    font-size: var(--fs-2);
  }
  .file {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .fhead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
  }
  .fhead h3 code {
    font-size: var(--fs-3);
  }
</style>
