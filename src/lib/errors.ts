// Wording of the error pages. Calm and plain; no jokes.

export interface ErrorCopy {
  /** Visible heading (read by assistive tech after the number) and the name in the title. */
  title: string;
  /** One short plain sentence. */
  message: string;
}

const KNOWN: Record<number, ErrorCopy> = {
  400: {
    title: 'Bad request',
    message: 'Bad request. The address could not be understood.'
  },
  404: {
    title: 'Not found',
    message: 'Page not found. The page may have moved, or the address has a typo.'
  },
  500: {
    title: 'Something broke',
    message: 'Something broke on our side. Try again in a moment; if it keeps happening, report it.'
  }
};

/** Copy for a status. Unlisted 4xx and 5xx codes fall back to the nearest generic wording. */
export function copyFor(status: number): ErrorCopy {
  if (Object.hasOwn(KNOWN, status)) return KNOWN[status]!;
  if (status >= 500 && status < 600) return KNOWN[500]!;
  if (status >= 400 && status < 500)
    return {
      title: 'Request not completed',
      message: 'The request could not be completed. The address may be wrong.'
    };
  return { title: 'Unexpected error', message: 'Something unexpected happened.' };
}

/** A path to show back to the reader: printable only, short. Never HTML; the caller escapes it. */
export function safePathForDisplay(pathname: string): string {
  const clean = pathname.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?');
  return clean.length > 200 ? `${clean.slice(0, 199)}…` : clean;
}
