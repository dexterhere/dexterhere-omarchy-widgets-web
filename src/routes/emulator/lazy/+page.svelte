<script lang="ts">
  import Seo from '../../../lib/components/Seo.svelte';
  import LazyEmulator from '../../../lib/emulator/LazyEmulator.svelte';
  import { theme } from '../../../lib/themes/store.svelte';
</script>

<Seo
  title="Emulated desktop (lazy)"
  description="A test page: the emulator chunk loads only when it nears the viewport, so the page itself stays light."
  path="/emulator/lazy/"
  noindex
/>

<!-- Demonstrates (and e2e-tests) that the emulator chunk loads only when it nears the viewport. -->
<div class="spacer">
  <p class="text-2">Scroll down: the emulator loads when it comes near the screen.</p>
</div>
<div class="wrap">
  <LazyEmulator onPickTheme={() => theme.openPicker()} />
</div>

<style>
  .spacer {
    height: 2400px;
    padding: 24px var(--gutter);
  }
  .wrap {
    padding: 0 var(--gutter) 48px;
  }
</style>
