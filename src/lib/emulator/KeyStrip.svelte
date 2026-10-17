<script lang="ts">
  import { MODS, type Mod } from './keys';
  import type { EmulatorState } from './state.svelte';

  // Virtual keys. Browsers cannot see the Super key reliably, so modifiers latch (sticky) for
  // the next keystroke and every chord can be clicked.
  let { emu }: { emu: EmulatorState } = $props();

  const MOD_NAMES: Record<Mod, string> = {
    super: 'Super',
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift'
  };
  // [label, accessible name, event.key, event.code]
  const KEYS: [string, string, string, string][] = [
    ['1', '1', '1', 'Digit1'],
    ['2', '2', '2', 'Digit2'],
    ['3', '3', '3', 'Digit3'],
    ['4', '4', '4', 'Digit4'],
    ['Tab', 'Tab', 'Tab', 'Tab'],
    ['Return', 'Return', 'Enter', 'Enter'],
    ['Space', 'Space', ' ', 'Space'],
    ['Q', 'Q', 'q', 'KeyQ'],
    ['W', 'W', 'w', 'KeyW'],
    ['T', 'T', 't', 'KeyT'],
    ['F', 'F', 'f', 'KeyF'],
    ['K', 'K', 'k', 'KeyK'],
    ['A', 'A', 'a', 'KeyA'],
    ['B', 'B', 'b', 'KeyB'],
    ['D', 'D', 'd', 'KeyD'],
    ['P', 'P', 'p', 'KeyP'],
    ['←', 'Left arrow', 'ArrowLeft', 'ArrowLeft'],
    ['↑', 'Up arrow', 'ArrowUp', 'ArrowUp'],
    ['↓', 'Down arrow', 'ArrowDown', 'ArrowDown'],
    ['→', 'Right arrow', 'ArrowRight', 'ArrowRight']
  ];
</script>

<div class="strip" role="group" aria-label="Virtual keys">
  <div class="mods">
    {#each MODS as m (m)}
      <button
        type="button"
        class="mod"
        data-mod={m}
        aria-pressed={emu.sticky.includes(m)}
        title="Latches {MOD_NAMES[m]} for the next key"
        onclick={() => emu.toggleMod(m)}>{MOD_NAMES[m]}</button
      >
    {/each}
  </div>
  <div class="keys">
    {#each KEYS as [label, name, key, code] (code)}
      <button
        type="button"
        class="key"
        data-key={code}
        aria-label={name}
        onclick={() => emu.press(key, code)}>{label}</button
      >
    {/each}
  </div>
</div>

<style>
  .strip {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    align-items: center;
  }
  .mods,
  .keys {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  button {
    all: unset;
    box-sizing: border-box;
    min-width: 32px;
    height: 28px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border-strong);
    border-bottom-width: 3px;
    font: 400 12px / 1 var(--font-mono);
  }
  button:hover {
    border-color: var(--brand);
  }
  button:active {
    border-bottom-width: 1px;
    transform: translateY(2px);
  }
  button:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  button[aria-pressed='true'] {
    background: var(--brand);
    color: var(--brand-ink);
    border-color: var(--brand);
    font-weight: 700;
  }
</style>
