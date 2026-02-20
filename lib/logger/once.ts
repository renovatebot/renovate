import { createHash } from 'node:crypto';
import { stringify } from 'safe-stable-stringify';

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
  // We don't use `Error.captureStackTrace` directly, we simply restore it later.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const prepareStackTraceOrig = Error.prepareStackTrace;

  let result: string | null = null;
  try {
    const res: { stack: string[] } = { stack: [] };

    Error.stackTraceLimit = 1;
    Error.prepareStackTrace = (_err, stack) => stack;
    Error.captureStackTrace(res, omitFn);

    const [callsite] = res.stack;
    // v8 ignore else -- TODO: add test #40625
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

export function once(
  callback: () => void,
  omitFn: OmitFn = once,
  p1: string | Record<string, any>,
  p2?: string,
): void {
  const callsite = getCallSite(omitFn);

  /* v8 ignore next 3 -- should not happen */
  if (!callsite) {
    return;
  }

  const paramsKey = hashParams(p1, p2);
  const key = `${callsite}|${paramsKey}`;

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

function hashParams(p1: string | Record<string, any>, p2?: string): string {
  const data =
    p2 === undefined ? stringify(p1) : `${stringify(p1)}|${stringify(p2)}`;
  return createHash('sha256').update(data).digest('hex');
}
