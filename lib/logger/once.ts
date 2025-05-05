type OmitFn = (...args: any[]) => any;

// TODO: use `callsite` package instead?

/**
 * Get the single frame of this function's callers stack.
 *
 * @param omitFn Starting from this function, stack frames will be ignored.
 * @returns The string containing file name, line number and column name.
 *
 * @example getCallSite() // => 'Object.<anonymous> (/path/to/file.js:10:15)'
 */
function getCallSite(omitFn: OmitFn): string | null {
  const stackTraceLimitOrig = Error.stackTraceLimit;
  const prepareStackTraceOrig = Error.prepareStackTrace;

  let result: string | null = null;
  try {
    const res: { stack: string[] } = { stack: [] };

    Error.stackTraceLimit = 1;
    Error.prepareStackTrace = (_err, stack) => stack;
    Error.captureStackTrace(res, omitFn);

    const [callsite] = res.stack;
    if (callsite) {
      result = callsite.toString();
    }
    /* v8 ignore next 2 -- should not happen */
  } catch {
    // no-op
  } finally {
    Error.stackTraceLimit = stackTraceLimitOrig;
    Error.prepareStackTrace = prepareStackTraceOrig;
  }

  return result;
}

const keys = new Set<string>();

export function once(callback: () => void, omitFn: OmitFn = once): void {
  const key = getCallSite(omitFn);

  /* v8 ignore next 3 -- should not happen */
  if (!key) {
    return;
  }

  if (!keys.has(key)) {
    keys.add(key);
    callback();
  }
}

/**
 * Before processing each repository,
 * all keys are supposed to be reset.
 */
export function reset(): void {
  keys.clear();
}
