// Types for validators.generated.js (written by scripts/gen-make-validators.ts).
interface Validate {
  (data: unknown): boolean;
  errors?: { instancePath: string; message?: string }[] | null;
}
export const listing: Validate;
export const widget: Validate;
export const manifest: Validate;
