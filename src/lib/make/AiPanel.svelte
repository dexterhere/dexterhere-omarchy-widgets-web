<script lang="ts">
  import Code from './Code.svelte';
  import CopyButton from '../components/CopyButton.svelte';
  import { urls } from '../site';
  import { SKILL_IDS, aiPrompt, installSkills } from './ai';
  import type { MakeStore } from './store.svelte';

  let { store }: { store: MakeStore } = $props();
  const origin = urls.site('').replace(/\/+$/, '');
  const prompt = $derived(aiPrompt(store.draft, origin));
  const install = installSkills(origin).join('\n');
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- external GitHub and tool links, and in-page anchors -->

<details class="ai" id="describe">
  <summary>Prefer to describe it in words?</summary>
  <div class="body">
    <p class="small">
      You can ask an AI coding assistant (for example Claude Code) to make the files for you. To do
      that well, it needs instructions written for this project. These are called <strong
        >Agent Skills</strong
      >: plain text files, called <code>SKILL.md</code>, that your assistant reads before it works.
      There are four, and you use them in this order:
    </p>
    <ol class="skills">
      {#each SKILL_IDS as [sid, what] (sid)}
        <li>
          <a href="{origin}/skills/{sid}/SKILL.md" rel="noopener noreferrer"><code>{sid}</code></a>
          <span class="small text-2">{what}</span>
        </li>
      {/each}
    </ol>
    <h3>1. Give your assistant the skills</h3>
    <p class="small">
      In a terminal, this saves them where Claude Code looks for skills. Read each file first: a
      skill is instructions your assistant will follow. With another assistant, paste the text of
      each file into the chat instead.
    </p>
    <div class="cmd">
      <CopyButton text={install} label="Copy the install commands" />
      <Code text={install} label="Install commands" />
    </div>
    <h3>2. Paste this prompt</h3>
    <p class="small">
      Edit the idea in the brackets, or fill in the first step above and it is written in for you.
    </p>
    <div class="cmd">
      <CopyButton text={prompt} label="Copy the prompt" />
      <Code text={prompt} label="Prompt" testid="ai-prompt" wrap />
    </div>
    <p class="small text-2">
      The assistant works on your computer and never opens the pull request for you. Review what it
      writes like a stranger's code, and never paste passwords or tokens into a chat. When it is
      done, come back and use step 3 to check the files.
    </p>
  </div>
</details>

<style>
  .ai {
    border: 1px solid var(--border-strong);
    background: var(--surface);
  }
  summary {
    padding: 14px 16px;
    cursor: pointer;
    font-weight: 700;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 16px 16px;
  }
  .skills {
    margin: 0;
    padding-left: 24px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .skills li {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
  }
  h3 {
    font-size: var(--fs-3);
  }
</style>
