type OmitFn = (...args: any[]) => any;

/**
 * Get the single frame of this function's callers stack.
 *
 * @param omitFn Starting from this function, stack frames will be ignored.
 * @returns The string containing file name, line number and column name.
 *
 * @example getCallSite() // => 'Object.<anonymous> (/path/to/file.js:10:15)'
 */
function getCallSite(omitFn: OmitFn = getCallSite): string | null {
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
  } catch (_err) /* istanbul ignore next */ {
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

  // istanbul ignore if
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
