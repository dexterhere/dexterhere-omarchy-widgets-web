// State of the /make/ flow: which step, the draft, and its copy in localStorage (try/catch
// everywhere: it works without storage, and anything read back is rebuilt by restoreDraft).
import {
  identityErrors,
  identityOk,
  newDraft,
  restoreDraft,
  withTemplate,
  type Draft,
  type IdentityErrors
} from './draft';
import { problemsOf } from './edit';
import type { TemplateId } from './templates';

export const KEY = 'ow-make-v1';
export const STEPS = [
  { n: 1, title: 'Start' },
  { n: 2, title: 'Shape it' },
  { n: 3, title: 'Get your files' },
  { n: 4, title: 'Publish' }
] as const;

export class MakeStore {
  step = $state(1);
  draft = $state<Draft>(newDraft());
  /** Set once storage has been read, so a save never overwrites a draft that was not loaded yet. */
  ready = $state(false);
  showErrors = $state(false);
  /** The layout style being edited and previewed: '' is the default layout, else a variant name. */
  style = $state('');
  saved = $state(false);

  errors = $derived<IdentityErrors>(identityErrors(this.draft));
  layoutProblems = $derived(problemsOf(this.draft.layout));
  /** True once the person has typed or changed anything. */
  touched = $derived(
    this.step > 1 ||
      !!(this.draft.name || this.draft.description || this.draft.user || this.draft.commit) ||
      this.draft.template !== 'blank'
  );

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const v: unknown = JSON.parse(raw);
        if (typeof v === 'object' && v !== null) {
          const o = v as { step?: unknown; draft?: unknown };
          this.draft = restoreDraft(o.draft);
          const s = Number(o.step);
          this.step = Number.isInteger(s) && s >= 1 && s <= 4 ? s : 1;
          // A restored later step needs a valid first step; otherwise start there.
          if (this.step > 1 && !identityOk(this.draft)) this.step = 1;
          this.saved = true;
        }
      }
    } catch {
      /* private window or blocked storage: carry on without it */
    }
    this.ready = true;
  }

  save() {
    if (!this.ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 1, step: this.step, draft: this.draft }));
    } catch {
      /* ignore */
    }
  }

  pick(t: TemplateId) {
    this.draft = withTemplate(this.draft, t);
  }

  setName(v: string) {
    this.draft.name = v;
  }

  setSlug(v: string) {
    this.draft.slug = v;
    this.draft.slugTouched = true;
  }

  followName() {
    this.draft.slug = '';
    this.draft.slugTouched = false;
  }

  /** Move to a step. Going forward needs step 1 filled in; step 2 needs a layout with no problems. */
  go(n: number): boolean {
    if (n < 1 || n > 4 || n === this.step) return n === this.step;
    if (n > 1 && !identityOk(this.draft)) {
      this.showErrors = true;
      return false;
    }
    if (n > 2 && this.layoutProblems.length) return false;
    this.step = n;
    return true;
  }

  reset() {
    this.draft = newDraft();
    this.step = 1;
    this.style = '';
    this.showErrors = false;
    this.saved = false;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
