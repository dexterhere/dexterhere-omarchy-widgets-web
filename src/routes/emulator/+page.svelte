<script lang="ts">
  import Emulator from '../../lib/emulator/Emulator.svelte';
  import { theme } from '../../lib/themes/store.svelte';
</script>

<svelte:head>
  <title>Emulated desktop - Omarchy Widgets</title>
  <meta
    name="description"
    content="An emulated Omarchy desktop in your browser: top bar, tiled windows, workspaces and the real default keybindings. Sample data only."
  />
</svelte:head>

<div class="wrap">
  <h1>Emulated desktop</h1>
  <p class="text-2 intro">
    A replica of an Omarchy 4 desktop running in your browser, with sample data. Nothing here reads
    your machine.
  </p>
  <Emulator onPickTheme={() => theme.openPicker()} />
</div>

<style>
  .wrap {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    padding: 24px var(--gutter) 48px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .intro {
    max-width: 72ch;
  }
  h1 {
    font-size: var(--fs-5);
    line-height: 36px;
  }
</style>
