// The fake terminal's tiny command set. Everything printed is sample output and says so.

/** Longest command line the fake terminal takes (input maxlength and echo). */
export const MAX_INPUT = 512;

export const SAMPLE = '(sample output)';

export const FASTFETCH: string[] = [
  'user@omarchy-emulated',
  '---------------------',
  'OS        Omarchy 4 (emulated)',
  'WM        Hyprland (emulated)',
  'Shell     bash',
  'Terminal  emulated terminal',
  'Theme     follows the site theme',
  'Memory    3.1 GiB / 15.4 GiB',
  SAMPLE
];

const HELP = [
  'Commands in this emulated terminal:',
  '  help             this list',
  '  clear            clear the screen',
  '  neofetch         system summary',
  '  ow status        widget host status',
  '  ow vault status  secrets vault status',
  SAMPLE
];

const OW_STATUS = [
  'ow: widget host running',
  '  widgets enabled   4',
  '  layer             bottom',
  '  data providers    3 ready',
  SAMPLE
];
const OW_VAULT = [
  'vault: locked, 0 secrets read this session',
  '  widgets never receive tokens; the host calls providers for them',
  SAMPLE
];

/** Output lines for a command, or 'clear'. Unknown commands get a calm error. */
export function runCommand(input: string): string[] | 'clear' {
  const cmd = input.trim().replace(/\s+/g, ' ');
  switch (cmd) {
    case '':
      return [];
    case 'clear':
      return 'clear';
    case 'help':
      return HELP;
    case 'neofetch':
    case 'fastfetch':
      return FASTFETCH;
    case 'ow status':
      return OW_STATUS;
    case 'ow vault status':
      return OW_VAULT;
    default:
      return [`bash: ${cmd.slice(0, 40)}: command not found (type help)`];
  }
}
