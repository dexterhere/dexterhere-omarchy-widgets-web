// Same shape as the registry build's SAFE_ID (scripts/build-registry.ts), plus a length cap.
// services/stats/src/validate.ts keeps its own copy: the service is a separate package.
const ID_RE = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/;
export const MAX_ID_LENGTH = 128;

export const isWidgetId = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= MAX_ID_LENGTH && ID_RE.test(v);
