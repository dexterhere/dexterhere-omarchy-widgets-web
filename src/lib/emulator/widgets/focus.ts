import { tick } from 'svelte';

/**
 * After a widget is removed its element is gone, so focus must go somewhere real: the next
 * widget, or the Widget Center tab when the sheet is open, or the toolbar's Done button.
 */
export async function refocus(from: Element | null, next: string | null) {
  await tick();
  const root = from?.closest('[data-emulator]') ?? document;
  const sheet = root.querySelector<HTMLElement>('[data-widget-center] [role="tab"][tabindex="0"]');
  const slot = next ? root.querySelector<HTMLElement>(`[data-widget-id="${next}"]`) : null;
  (sheet ?? slot ?? root.querySelector<HTMLElement>('[data-edit-done]'))?.focus();
}
