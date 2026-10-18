<script lang="ts">
  import { untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { theme } from '../../themes/store.svelte';
  import { THEMES } from '../../themes/themes';
  import type { EmulatorApi, WidgetEmulatorProps } from '../api';
  import Emulator from '../Emulator.svelte';
  import Layer from './Layer.svelte';
  import Overlay from './Overlay.svelte';
  import { WidgetLayerState } from './store.svelte';
  import WidgetCenter from './WidgetCenter.svelte';

  // The emulator plus the proposed widget experience. Everything widget-related plugs into the
  // shell through its typed hooks; nothing is stored (the layout lives in memory only).
  let {
    initialWidgets,
    openCenter = false,
    selectedWidgetId,
    onapi,
    ...rest
  }: WidgetEmulatorProps = $props();

  // svelte-ignore state_referenced_locally
  const wl = new WidgetLayerState(initialWidgets, selectedWidgetId);
  let api = $state<EmulatorApi>();
  const narrow = new MediaQuery('max-width: 719px');
  const themeName = $derived(
    THEMES.find((t) => t.id === (rest.themeId ?? theme.current))?.name ?? 'Theme'
  );

  function handleApi(a: EmulatorApi) {
    api = a;
    wl.attach(a);
    a.state.escapeHook = () => wl.escape();
    a.state.resetHook = () => wl.reset();
    onapi?.(a);
    if (openCenter && !narrow.current) a.openWidgetCenter();
  }

  // Opening the Widget Center, by any route, enters edit mode.
  $effect(() => {
    if (api?.state.panel === 'widgets') untrack(() => wl.setEditing(true));
  });

  // Below 720 px: a static illustration. Widgets show on the empty workspace, no editing.
  $effect(() => {
    wl.wantNarrow = narrow.current;
    if (narrow.current && api) {
      wl.setEditing(false, true);
      api.state.ws = 2;
    }
  });

  function onKeyDown(e: KeyboardEvent) {
    if (!wl.editing || !(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'z') return;
    const t = e.target as HTMLElement | null;
    if (!t?.closest('[data-emulator]') || t.closest('input, textarea, select')) return;
    e.preventDefault();
    if (e.shiftKey) wl.redo();
    else wl.undo();
  }
  // Peek is held while Super+Alt+P is physically held; releasing any of the three lets go.
  function onKeyUp(e: KeyboardEvent) {
    const s = api?.state;
    if (!s?.peekHeld || !['p', 'meta', 'alt', 'os'].includes(e.key.toLowerCase())) return;
    s.peekHeld = false;
    s.peek = false;
    s.announce('Peek widgets (proposed) off: widgets are under the windows');
  }
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />

{#snippet bottom()}
  <Layer {wl} lifted={false} />
{/snippet}
{#snippet lifted()}
  <Layer {wl} lifted={true} />
{/snippet}
{#snippet overlay()}
  <Overlay {wl} />
{/snippet}
{#snippet center(a: EmulatorApi)}
  <WidgetCenter {wl} api={a} {themeName} onPickTheme={rest.onPickTheme} />
{/snippet}

<Emulator
  {...rest}
  onapi={handleApi}
  widgetLayer={bottom}
  liftedLayer={lifted}
  overlayLayer={overlay}
  widgetCenter={center}
/>
