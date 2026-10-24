// Step 4: the listing file, the commands and the AI prompt, written from a draft. Pure.
// Only values the draft has already validated (username, id ending, id, hash) go into a command.
// Free text such as the name never does, so nothing a person typed can run in their shell.
import { descOf, idOf, repoOf, repoUrl, slugOf, userOf, type Draft } from './draft';
import { licenseFile } from './files';

export const REGISTRY_REPO = 'dexterhere/dexterhere-omarchy-widgets-web';
export const REGISTRY_URL = `https://github.com/${REGISTRY_REPO}`;
export const COMMIT_RE = /^[0-9a-f]{40}$/;
export const COMMIT_PLACEHOLDER = 'PASTE_THE_40_CHARACTER_COMMIT_HASH_HERE';

/** What the person pasted, tidied the way the registry needs it (trimmed, lowercase). */
export const tidyCommit = (s: string) => s.trim().toLowerCase();
export const commitOk = (s: string) => COMMIT_RE.test(tidyCommit(s));

export function tagsOf(d: Draft): string[] {
  const words = slugOf(d)
    .split('-')
    .filter((w) => w.length >= 2)
    .map((w) => w.slice(0, 24));
  return [...new Set([...words, d.template === 'blank' ? 'custom' : d.template])].slice(0, 5);
}

export function listingOf(d: Draft, commit?: string) {
  return {
    id: idOf(d),
    repo: repoUrl(d),
    commit: commit && commitOk(commit) ? tidyCommit(commit) : COMMIT_PLACEHOLDER,
    categories: [d.category],
    tags: tagsOf(d),
    summary: descOf(d),
    status: 'planned'
  };
}
export const listingText = (d: Draft, commit?: string) =>
  JSON.stringify(listingOf(d, commit), null, 2) + '\n';

export interface Cmd {
  /** What this does, in a short sentence. */
  say: string;
  /** Lines to paste in a terminal. */
  lines: string[];
}

export function terminalSteps(d: Draft, year = new Date().getFullYear()): Cmd[] {
  const user = userOf(d);
  const repo = repoOf(d);
  const slug = slugOf(d);
  const id = idOf(d);
  const lic = licenseFile(d, year);
  const commit = commitOk(d.commit) ? tidyCommit(d.commit) : COMMIT_PLACEHOLDER;
  return [
    {
      say: 'Make a folder for the widget and put the downloaded files in it.',
      lines: [
        `mkdir ${repo} && cd ${repo}`,
        `unzip ~/Downloads/${repo}.zip   # use the folder your browser saved it in`,
        ...(lic.kind === 'fetch' ? [lic.command] : [])
      ]
    },
    {
      say: 'Turn the folder into a Git repository and save the first commit.',
      lines: ['git init -b main', 'git add .', 'git commit -m "Add the widget files"']
    },
    {
      say: 'Create the public repository on GitHub and upload it (this needs the GitHub CLI, gh, signed in with gh auth login).',
      lines: [`gh repo create ${user}/${repo} --public --source . --push`]
    },
    {
      say: 'Print the commit hash. Paste the 40 characters into the box above.',
      lines: ['git rev-parse HEAD']
    },
    {
      say: 'Fork the registry, clone your fork and start a branch for your listing.',
      lines: [
        `gh repo fork ${REGISTRY_REPO} --clone`,
        'cd dexterhere-omarchy-widgets-web',
        'git fetch upstream',
        `git switch -c add-${slug} upstream/develop`
      ]
    },
    {
      say: 'Write the listing file (this is the text from the box below).',
      lines: [
        `cat > registry/widgets/${id}.json <<'EOF'`,
        ...listingText(d, commit).trimEnd().split('\n'),
        'EOF'
      ]
    },
    {
      say: 'Run the registry check on your machine. It needs bun (bun.sh). "Pending maintainer approval" is expected.',
      lines: [
        'bun install --frozen-lockfile',
        'GITHUB_TOKEN="$(gh auth token)" bun run registry -- --strict'
      ]
    },
    {
      say: 'Commit the listing, push it and open the pull request.',
      lines: [
        `git add registry/widgets/${id}.json`,
        `git commit -m "feat(registry): list ${id}"`,
        `git push -u origin add-${slug}`,
        `gh pr create --repo ${REGISTRY_REPO} --base develop --head ${user}:add-${slug} --title "Add ${id}" --body "Listing for ${repoUrl(d)} at commit ${commit}."`
      ]
    }
  ];
}

export const SKILL_IDS = [
  [
    'omarchy-widget-plan',
    'Turns your idea into a written plan and checks whether it already exists.'
  ],
  ['omarchy-widget-develop', 'Writes the files from the plan, following the security rules.'],
  ['omarchy-widget-test', 'Tests it and tells you what to fix.'],
  ['omarchy-widget-submit', 'Prepares the listing file and the pull request text.']
] as const;

export function aiPrompt(d: Draft, siteOrigin: string): string {
  const user = userOf(d) || '<your GitHub username>';
  const idea = descOf(d) || '<describe your widget in a few sentences>';
  return `I want to make a widget for Omarchy Widgets (a desktop widget registry for Omarchy, Arch Linux). My idea: ${idea}

My GitHub username is ${user}.

Please use these four Agent Skills, in order: omarchy-widget-plan, omarchy-widget-develop, omarchy-widget-test, omarchy-widget-submit. They are at ${siteOrigin}/skills/<name>/SKILL.md.

Rules: make a spec widget (JSON files, no code) if it can do the job. Only use data fields that exist in registry/providers.json. Do not invent commands: the project is pre-release, widgets cannot be installed yet, and the listing status is "planned". Stop and ask me when something is unclear. Do not open the pull request for me.`;
}

export function installSkills(siteOrigin: string): string[] {
  return [
    `SITE="${siteOrigin}"`,
    `for s in ${SKILL_IDS.map(([id]) => id).join(' ')}; do`,
    '  mkdir -p ~/.claude/skills/$s',
    '  curl -fsSL "$SITE/skills/$s/SKILL.md" -o ~/.claude/skills/$s/SKILL.md',
    'done'
  ];
}
