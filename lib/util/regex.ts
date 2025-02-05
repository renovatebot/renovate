import is from '@sindresorhus/is';
import { CONFIG_VALIDATION } from '../constants/error-messages';
import { re2 } from '../expose.cjs';

const cache = new Map<string, RegExp>();

type RegExpEngineStatus =
  | { type: 'available' }
  | {
      type: 'unavailable';
      err: Error;
    }
  | { type: 'ignored' };

let status: RegExpEngineStatus;
let RegEx: RegExpConstructor = RegExp;
// istanbul ignore next
if (process.env.RENOVATE_X_IGNORE_RE2) {
  status = { type: 'ignored' };
} else {
  try {
    const RE2 = re2();
    // Test if native is working
    new RE2('.*').exec('test');
    RegEx = RE2;
    status = { type: 'available' };
  } catch (err) {
    status = { type: 'unavailable', err };
  }
}

export const regexEngineStatus = status;

export function regEx(
  pattern: string | RegExp,
  flags?: string,
  useCache = true,
): RegExp {
  let canBeCached = useCache;
  if (canBeCached && flags?.includes('g')) {
    canBeCached = false;
  }
  if (canBeCached && is.regExp(pattern) && pattern.flags.includes('g')) {
    canBeCached = false;
  }

  const key = flags ? `${pattern.toString()}:${flags}` : pattern.toString();
  if (canBeCached) {
    const cachedResult = cache.get(key);
    if (cachedResult) {
      return cachedResult;
    }
  }

  try {
    const instance = flags ? new RegEx(pattern, flags) : new RegEx(pattern);
    if (canBeCached) {
      cache.set(key, instance);
    }
    return instance;
  } catch (err) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationMessage = err.message;
    error.validationSource = pattern.toString();
    error.validationError = `Invalid regular expression (re2): ${pattern.toString()}`;
    throw error;
  }
}

export function escapeRegExp(input: string): string {
  return input.replace(regEx(/[.*+\-?^${}()|[\]\\]/g), '\\$&'); // $& means the whole matched string
}

export const newlineRegex = regEx(/\r?\n/);
