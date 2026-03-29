/**
 * Development-only logging. Avoid console noise and accidental production logs (see CLAUDE.md).
 */
function formatUnknownError(error: unknown): {
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (__DEV__) {
      if (meta !== undefined) {
        console.debug(`[Sanctuary] ${message}`, meta);
      } else {
        console.debug(`[Sanctuary] ${message}`);
      }
    }
  },

  warn(message: string, error?: unknown): void {
    if (__DEV__) {
      console.warn(
        `[Sanctuary] ${message}`,
        error !== undefined ? formatUnknownError(error) : "",
      );
    }
  },

  error(message: string, error?: unknown): void {
    if (__DEV__) {
      console.error(
        `[Sanctuary] ${message}`,
        error !== undefined ? formatUnknownError(error) : "",
      );
    }
  },
};
