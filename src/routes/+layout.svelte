<script lang="ts">
  import '@fontsource-variable/jetbrains-mono';
  import '@fontsource-variable/geist';
  import '../app.css';
  import { onMount } from 'svelte';
  import Header from '../lib/components/Header.svelte';
  import Footer from '../lib/components/Footer.svelte';
  import ThemePicker from '../lib/components/ThemePicker.svelte';
  import ThemeHint from '../lib/components/ThemeHint.svelte';
  import { theme } from '../lib/themes/store.svelte';

  let { children } = $props();
  onMount(() => theme.init());
</script>

<a class="skip" href="#main">Skip to content</a>
<Header />
<main id="main">
  {@render children()}
</main>
<Footer />
<ThemePicker />
<ThemeHint />
