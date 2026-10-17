<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { EmulatorApi } from './api';
  import Icon from './Icon.svelte';
  import { PANEL_NAMES, type EmulatorState } from './state.svelte';

  let {
    emu,
    left,
    api,
    widgetCenter
  }: {
    emu: EmulatorState;
    left: number;
    api: EmulatorApi;
    widgetCenter?: Snippet<[EmulatorApi]>;
  } = $props();

  const id = $derived(emu.panel);

  // October 2026, Monday first. A fixed sample date: nothing is read from the machine.
  const FIRST = new Date(Date.UTC(2026, 9, 1)).getUTCDay();
  const lead = (FIRST + 6) % 7;
  const days = Array.from({ length: lead + 31 }, (_, i) => (i < lead ? 0 : i - lead + 1));
  const TODAY = 16;

  const nets = ['Sample-WiFi', 'Sample-Guest', 'Sample-Office'];
  const devices = ['Sample headphones', 'Sample keyboard'];
  const profiles = [
    ['saver', 'Power saver'],
    ['balanced', 'Balanced'],
    ['performance', 'Performance']
  ] as const;
</script>

{#if id}
  <div
    class="panel"
    class:wide={id === 'widgets'}
    role="dialog"
    aria-label="{PANEL_NAMES[id]} panel"
    data-panel={id}
    style:left="{left}px"
  >
    {#if id === 'audio'}
      <h3>Audio <small>sample</small></h3>
      <label class="row"
        ><span>Volume {emu.volume}%</span>
        <input type="range" min="0" max="100" bind:value={emu.volume} />
      </label>
      <button
        type="button"
        class="btn"
        aria-pressed={emu.muted}
        onclick={() => {
          emu.muted = !emu.muted;
          emu.announce(emu.muted ? 'Audio muted' : 'Audio unmuted');
        }}
      >
        <Icon name={emu.muted ? 'muted' : 'audio'} />
        {emu.muted ? 'Unmute' : 'Mute'}
      </button>
      <p class="note">Output: Built-in speakers (sample)</p>
    {:else if id === 'network'}
      <h3>Network <small>sample</small></h3>
      <button
        type="button"
        class="btn"
        aria-pressed={emu.wifi}
        onclick={() => (emu.wifi = !emu.wifi)}>Wi-Fi: {emu.wifi ? 'on' : 'off'}</button
      >
      <ul>
        {#each nets as n (n)}
          <li>
            <button
              type="button"
              class="btn"
              disabled={!emu.wifi}
              aria-pressed={emu.wifi && emu.network === n}
              onclick={() => {
                emu.network = n;
                emu.announce(`Connected to ${n} (sample)`);
              }}
            >
              {n}{emu.wifi && emu.network === n ? ' (connected)' : ''}
            </button>
          </li>
        {/each}
      </ul>
    {:else if id === 'bluetooth'}
      <h3>Bluetooth <small>sample</small></h3>
      <button
        type="button"
        class="btn"
        aria-pressed={emu.bluetooth}
        onclick={() => (emu.bluetooth = !emu.bluetooth)}
        >Bluetooth: {emu.bluetooth ? 'on' : 'off'}</button
      >
      <ul>
        {#each devices as dv (dv)}
          <li>
            <button
              type="button"
              class="btn"
              disabled={!emu.bluetooth}
              aria-pressed={emu.bluetooth && emu.btConnected === dv}
              onclick={() => (emu.btConnected = emu.btConnected === dv ? '' : dv)}
            >
              {dv}{emu.bluetooth && emu.btConnected === dv ? ' (connected)' : ''}
            </button>
          </li>
        {/each}
      </ul>
    {:else if id === 'display'}
      <h3>Display <small>sample</small></h3>
      <label class="row"
        ><span>Brightness {emu.brightness}%</span>
        <input type="range" min="5" max="100" bind:value={emu.brightness} />
      </label>
      <button
        type="button"
        class="btn"
        aria-pressed={emu.modes.nightlight}
        onclick={() => emu.toggleMode('nightlight')}
        >Night light: {emu.modes.nightlight ? 'on' : 'off'}</button
      >
      <button
        type="button"
        class="btn"
        aria-pressed={emu.barTransparent}
        onclick={() => (emu.barTransparent = !emu.barTransparent)}
        >Transparent bar: {emu.barTransparent ? 'on' : 'off'}</button
      >
    {:else if id === 'power'}
      <h3>Power <small>sample</small></h3>
      <p class="big">Battery {emu.battery}%</p>
      <div class="meter" role="img" aria-label="Battery {emu.battery} percent">
        <span style:width="{emu.battery}%"></span>
      </div>
      <ul>
        {#each profiles as [pid, name] (pid)}
          <li>
            <button
              type="button"
              class="btn"
              aria-pressed={emu.powerProfile === pid}
              onclick={() => (emu.powerProfile = pid)}>{name}</button
            >
          </li>
        {/each}
      </ul>
    {:else if id === 'calendar'}
      <h3>October 2026 <small>sample date</small></h3>
      <div class="cal">
        {#each ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as d (d)}<span class="dow">{d}</span
          >{/each}
        {#each days as d, i (i)}
          {#if d === 0}<span></span>{:else}<span class="day" class:today={d === TODAY}>{d}</span
            >{/if}
        {/each}
      </div>
      <button type="button" class="btn" onclick={() => emu.clockFormat++}
        >Change clock format</button
      >
    {:else if id === 'tray'}
      <h3>Tray <small>sample</small></h3>
      <p class="note">No tray applications in this emulated desktop.</p>
    {:else if id === 'widgets'}
      <h3>Widget Center <small class="prop">Proposed</small></h3>
      {#if widgetCenter}
        {@render widgetCenter(api)}
      {:else}
        <p>Widget Center: coming in the next step</p>
        <p class="note">
          The Widget Center is our proposal, not part of Omarchy. Chord: Super+Alt+W (proposed).
        </p>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .panel {
    position: absolute;
    top: calc(var(--bar-h) + 4px);
    z-index: 40;
    width: 232px;
    max-width: calc(100% - 8px);
    box-sizing: border-box;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--surface);
    color: var(--text);
    border: 2px solid var(--border-strong);
    font: 400 12px / 16px var(--font-mono);
  }
  .panel.wide {
    width: 300px;
  }
  h3 {
    margin: 0;
    font: 700 12px / 16px var(--font-mono);
    letter-spacing: 0;
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  small {
    font-weight: 400;
    color: var(--muted);
  }
  small.prop {
    color: var(--text);
    border: 1px solid var(--border-strong);
    padding: 0 4px;
  }
  p {
    margin: 0;
    max-width: none;
  }
  .note {
    color: var(--muted);
  }
  .big {
    font-size: 16px;
    line-height: 20px;
    font-weight: 700;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--brand);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .btn {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    cursor: pointer;
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--border-strong);
  }
  .btn:hover:not(:disabled) {
    border-color: var(--brand);
  }
  .btn[aria-pressed='true'] {
    background: var(--brand-soft);
  }
  .btn:disabled {
    cursor: not-allowed;
    color: var(--muted);
  }
  .btn:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .meter {
    height: 8px;
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--brand);
  }
  .cal {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    text-align: center;
  }
  .dow {
    color: var(--muted);
  }
  .day.today {
    background: var(--brand);
    color: var(--brand-ink);
    font-weight: 700;
  }
</style>
