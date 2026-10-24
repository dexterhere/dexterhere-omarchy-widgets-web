<script lang="ts">
  import Code from './Code.svelte';
  import CopyButton from '../components/CopyButton.svelte';
  import { docsUrl, sitePath } from '../site';
  import { idOf, repoOf } from './draft';
  import { licenseFile } from './files';
  import { COMMIT_RE, REGISTRY_URL, listingText, terminalSteps, tidyCommit } from './publish';
  import type { MakeStore } from './store.svelte';

  let { store }: { store: MakeStore } = $props();
  const d = $derived(store.draft);
  let how = $state<'terminal' | 'web'>('terminal');
  const year = new Date().getFullYear();
  const steps = $derived(terminalSteps(d, year));
  const lic = $derived(licenseFile(d, year));
  const id = $derived(idOf(d));
  const commit = $derived(tidyCommit(d.commit));
  const commitBad = $derived(!!d.commit.trim() && !COMMIT_RE.test(commit));
  const listing = $derived(listingText(d, d.commit));
  // The commit step is the one that prints the hash; the box for it sits right after it.
  const hashAfter = 3;
  const CONTRIB =
    'https://github.com/dexterhere/dexterhere-omarchy-widgets-web/blob/develop/CONTRIBUTING.md';
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external GitHub and tool links, and in-page anchors -->

{#snippet commitBox()}
  <div class="field commit">
    <label for="m-commit">Commit hash (40 letters and numbers)</label>
    <input
      id="m-commit"
      type="text"
      autocomplete="off"
      spellcheck="false"
      inputmode="text"
      maxlength="80"
      placeholder="0123456789abcdef0123456789abcdef01234567"
      bind:value={store.draft.commit}
      aria-invalid={commitBad ? 'true' : undefined}
      aria-describedby="m-commit-h {commitBad ? 'm-commit-e' : ''}"
    />
    <p class="hint" id="m-commit-h">
      This pins the exact version the registry will read. Capital letters are turned into lowercase.
    </p>
    {#if commitBad}
      <p class="err" id="m-commit-e">
        A commit hash is exactly 40 characters, 0 to 9 and a to f. This has {commit.length}, or
        other characters. Do not use a branch name.
      </p>
    {:else if COMMIT_RE.test(commit)}
      <p class="small" role="status">
        <span class="tag on">Looks right</span> It is now in the listing file below.
      </p>
    {/if}
  </div>
{/snippet}

<div class="pub">
  <div class="callout" role="note" data-testid="planned-note">
    <p><strong>Widgets are not installable by visitors yet.</strong></p>
    <p class="small">
      The desktop layer that runs widgets has not shipped. Publishing now gets your widget listed in
      the gallery, where anyone can preview it on this website with sample data. Its status stays
      <strong>Planned</strong> until the desktop layer exists.
    </p>
  </div>

  <fieldset>
    <legend>How do you want to do it?</legend>
    <div class="seg">
      <label class:on={how === 'terminal'}
        ><input type="radio" name="how" value="terminal" bind:group={how} />I use a terminal</label
      >
      <label class:on={how === 'web'}
        ><input type="radio" name="how" value="web" bind:group={how} />I use the GitHub website</label
      >
    </div>
  </fieldset>

  {#if how === 'terminal'}
    <p class="small text-2">
      You need <a href="https://git-scm.com" rel="noopener noreferrer">Git</a>, the
      <a href="https://cli.github.com" rel="noopener noreferrer">GitHub CLI</a> (run
      <code>gh auth login</code> once) and
      <a href="https://bun.sh" rel="noopener noreferrer">bun</a>. Copy each block and paste it into
      a terminal.
    </p>
    <ol class="todo" data-testid="terminal-steps">
      {#each steps as s, i (i)}
        <li>
          <p>{s.say}</p>
          <div class="cmd">
            <CopyButton text={s.lines.join('\n')} label="Copy these commands" />
            <Code text={s.lines.join('\n')} label="Commands for step {i + 1}" />
          </div>
          {#if i === hashAfter}{@render commitBox()}{/if}
        </li>
      {/each}
    </ol>
  {:else}
    <ol class="todo" data-testid="web-steps">
      <li>
        <p>
          Create the repository. Open <a href="https://github.com/new" rel="noopener noreferrer"
            >github.com/new</a
          >. Under Repository name type the name below. Choose <strong>Public</strong>. Leave "Add a
          README file" unticked. Click <strong>Create repository</strong>.
        </p>
        <div class="cmd">
          <CopyButton text={repoOf(d)} label="Copy the repository name" />
          <Code text={repoOf(d)} label="Repository name" />
        </div>
      </li>
      <li>
        <p>
          Add your files. On the new page click <strong>uploading an existing file</strong>. Unzip
          the download from step 3 and drag the files in (the files, not the folder). Click
          <strong>Commit changes</strong>.
          {#if lic.kind === 'fetch'}
            Also save <a href={lic.url} rel="noopener noreferrer">{lic.url}</a> as a file called
            <code>LICENSE</code> and upload it too.
          {/if}
        </p>
      </li>
      <li>
        <p>
          Copy the commit hash. On your repository page click the commit count next to the branch
          name (it says, for example, "1 Commit"). On the newest commit click the copy icon. That
          copies the full 40-character hash. Paste it here:
        </p>
        {@render commitBox()}
      </li>
      <li>
        <p>
          Fork the registry. Open <a href={REGISTRY_URL} rel="noopener noreferrer">{REGISTRY_URL}</a
          >, click <strong>Fork</strong>, then <strong>Create fork</strong>.
        </p>
      </li>
      <li>
        <p>
          Add the listing. In your fork, open the branch menu and choose <strong>develop</strong>.
          Click <strong>Add file</strong>, then <strong>Create new file</strong>. In the name box
          type the path below (typing a slash makes a folder). Paste the listing file from the end
          of this page into the editor.
        </p>
        <div class="cmd">
          <CopyButton text="registry/widgets/{id}.json" label="Copy the file path" />
          <Code text="registry/widgets/{id}.json" label="File path" />
        </div>
      </li>
      <li>
        <p>
          Open the pull request. Click <strong>Commit changes</strong>, choose "Create a new branch
          for this commit and start a pull request", then <strong>Propose changes</strong>. On the
          next page check that the base branch is <code>develop</code> and click
          <strong>Create pull request</strong>.
        </p>
      </li>
    </ol>
  {/if}

  <section aria-labelledby="lst-h" class="blk">
    <h3 id="lst-h">Your listing file</h3>
    <p class="small text-2">
      Path: <code>registry/widgets/{id}.json</code>. The status is <code>planned</code>.
      {#if !COMMIT_RE.test(commit)}
        The <code>commit</code> line holds a placeholder until you paste your hash above.
      {/if}
    </p>
    <div class="cmd">
      <CopyButton text={listing} label="Copy listing file" />
      <Code text={listing} label="Listing file" testid="listing-json" />
    </div>
  </section>

  <section aria-labelledby="aft-h" class="blk">
    <h3 id="aft-h">What happens next</h3>
    <p class="small">
      Automatic checks run on your pull request, and a maintainer reads the code at your pinned
      commit. When they merge it they also approve your repository in <code>registry/lock.json</code
      >; merging alone does not publish it. After that your widget appears in the gallery as a
      community widget, which means no one has reviewed it beyond that, and its status stays Planned
      until widgets can be installed.
    </p>
    <p class="small">
      Changed your widget later? Push to your repository and open a new pull request that changes
      only the <code>commit</code> line. More detail: the
      <a href={docsUrl('/docs/v0.1/publish/submit-a-widget/')}>submit guide</a>, the
      <a href={CONTRIB} rel="noopener noreferrer">contributing rules</a> and the
      <a href={sitePath('/contribute/')}>Contribute page</a>.
    </p>
  </section>
</div>

<style>
  .pub {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .blk {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .todo {
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: t;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .todo > li {
    position: relative;
    counter-increment: t;
    padding-left: 48px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }
  .todo > li::before {
    content: counter(t);
    position: absolute;
    left: 0;
    top: 0;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border: 1px solid var(--brand);
    color: var(--brand);
    font-weight: 700;
  }
  .commit {
    max-width: 560px;
  }
  @media (max-width: 479px) {
    .todo > li {
      padding-left: 0;
      padding-top: 40px;
    }
  }
</style>
