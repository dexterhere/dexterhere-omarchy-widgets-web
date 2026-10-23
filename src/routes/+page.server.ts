// Home page text that only the prerendered HTML needs: the ideas grid and the JSON-LD. Loading it
// here keeps these strings out of the page's JavaScript bundle (the home JS budget is tight).
import type { Category } from '../lib/registry';
import { urls } from '../lib/site';

export function load() {
  // Ideas, not listed widgets: three prompts per registry category.
  const ideas: Record<Category, string[]> = {
    system: ['CPU and memory', 'Disk space left', 'Battery and power draw'],
    'time-calendar': ['World clocks', 'Your next meeting', 'Countdown to a deadline'],
    productivity: ['Focus timer', 'Habit streak', "Today's tasks"],
    'dev-git': ['Build monitor', 'Open pull requests', 'Deploy status'],
    'ai-agents': ['Agent run status', 'Token spend', 'Prompt queue'],
    media: ['Music deck', 'Podcast progress', 'Recording controls'],
    communication: ['Unread mail', 'Chat mentions', 'Missed calls'],
    'network-containers': ['Server status board', 'Container health', 'Ping and bandwidth'],
    'ambient-fun': ['Weather strip', 'Moon phase', 'Pixel pet'],
    utilities: ['Quick notes', 'Clipboard history', 'Unit converter']
  };

  const description =
    'Any widget you can think of, on your Omarchy desktop: build monitors, focus timers, server boards and more. Spec widgets are JSON, code widgets are QML.';
  const nodes = [
    { '@type': 'WebSite', name: 'Omarchy Widgets', url: urls.site('/'), description },
    {
      '@type': 'SoftwareApplication',
      name: 'Omarchy Widgets',
      description:
        'Open-source toolkit and registry for desktop widgets on Omarchy. Pre-release: the daemon, vault and CLI exist; the desktop canvas and Widget Center are in development.',
      url: urls.site('/'),
      applicationCategory: 'DesktopEnhancementApplication',
      operatingSystem: 'Linux (Omarchy)',
      license: 'https://opensource.org/licenses/MIT'
    },
    {
      '@type': 'SoftwareSourceCode',
      name: 'Omarchy Widgets',
      codeRepository: 'https://github.com/dexterhere/omarchy-widgets',
      license: 'https://opensource.org/licenses/MIT'
    }
  ];
  return { ideas, description, nodes };
}
