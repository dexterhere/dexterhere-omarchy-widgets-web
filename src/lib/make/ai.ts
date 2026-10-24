// The "describe it in words" route: the prompt and the skills. Pure.
import { descOf, userOf, type Draft } from './draft';

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
