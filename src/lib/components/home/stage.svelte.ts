// The home page's handle on its emulator stage: sections that live elsewhere on the page (the
// carousel, the builder) place widgets into the emulator and move the visitor's attention to it.
// Nothing here is stored; the emulator keeps its layout in memory only.
import type { SpecDoc } from '../../builder/spec';
import type { WidgetType } from '../../desktop/layout';
import type { EmulatorApi, WidgetsApi } from '../../emulator/api';
import { prefersReducedMotion } from '../../motion';

export class HomeStage {
  api = $state.raw<EmulatorApi | null>(null);
  widgets = $state.raw<WidgetsApi | null>(null);
  /** Ask the lazy emulator to load now (a visitor acted before it came near the viewport). */
  loadNow = $state(false);
  host: HTMLElement | undefined;
  private queue: ((w: WidgetsApi) => void)[] = [];

  setWidgets = (w: WidgetsApi) => {
    this.widgets = w;
    const q = this.queue;
    this.queue = [];
    for (const f of q) f(w);
  };

  whenReady(f: (w: WidgetsApi) => void) {
    if (this.widgets) f(this.widgets);
    else {
      this.queue.push(f);
      this.loadNow = true;
    }
  }

  /** Install a registry widget (a preview, for concepts) and show it on the desktop. */
  tryOn(reg: string) {
    this.whenReady((w) => {
      w.install(reg);
      this.reveal();
    });
  }

  placeSpec(spec: SpecDoc, size: { w: number; h: number; type: WidgetType }) {
    this.whenReady((w) => {
      if (w.placeSpec(spec, size)) this.reveal();
    });
  }

  /** Scroll the stage into view, make sure the widget is visible, and move focus into it. */
  reveal() {
    const host = this.host;
    if (!host) return;
    host.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
    const s = this.api?.state;
    if (s) s.coach = false;
    // Windows would hide a widget on the bottom layer: lift widgets above them (Peek).
    if (s && s.windowCount(s.ws) > 0 && !s.peek) s.togglePeek();
    const target =
      host.querySelector<HTMLElement>('[data-emulator] [role="group"][tabindex="0"]') ??
      host.querySelector<HTMLElement>('[data-emulator]');
    target?.focus({ preventScroll: true });
    // After the layer's own "added at x, y" message has been read.
    setTimeout(
      () =>
        this.api?.announce(
          'Focus is on the emulated desktop. Press Super plus Alt plus P, proposed, to toggle Peek.'
        ),
      1200
    );
  }
}
