// Home page text that only the prerendered HTML needs: the JSON-LD. Loading it
// here keeps these strings out of the page's JavaScript bundle (the home JS budget is tight).
import { urls } from '../lib/site';

export function load() {
  const description =
    'Clocks, stats, git, music or anything with data, on your Omarchy desktop. Spec widgets are JSON with no code; code widgets run as you.';
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
  return { description, nodes };
}
