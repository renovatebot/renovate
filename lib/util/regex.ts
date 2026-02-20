import { isRegExp } from '@sindresorhus/is';
import { CONFIG_VALIDATION } from '../constants/error-messages.ts';
import { re2 } from '../expose.ts';
import { getEnv } from './env.ts';

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
/* v8 ignore next 2 */
if (getEnv().RENOVATE_X_IGNORE_RE2) {
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
  if (canBeCached && isRegExp(pattern) && pattern.flags.includes('g')) {
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

/**
 * Matches hidden or invisible Unicode characters, including:
 * - Non-breaking space (\u00A0)
 * - Ogham space mark (\u1680)
 * - Various spaces (\u2000-\u200A)
 * - Line separator (\u2028)
 * - Paragraph separator (\u2029)
 * - Narrow no-break space (\u202F)
 * - Medium mathematical space (\u205F)
 * - Ideographic space (\u3000)
 * - Zero-width space (\u200B)
 * - Zero-width non-joiner (\u200C)
 * - Zero-width joiner (\u200D)
 * - Zero-width no-break space (\uFEFF)
 * - Left-to-right mark (\u200E)
 * - Right-to-left mark (\u200F)
 * - Bidirectional formatting characters (\u202A-\u202E)
 * - Soft hyphen (\u00AD)
 */
export const hiddenUnicodeCharactersRegex = regEx(
  /([\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\u200B\u200C\uFEFF\u200E\u200F\u202A-\u202E\u00AD\u200D])/g,
);

/**
 * Given unicode character(s), convert them to the \u0123 representation, to be output to a user.
 */
export function toUnicodeEscape(str: string): string {
  return str
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return '\\u' + code.toString(16).padStart(4, '0').toUpperCase();
    })
    .join('');
}
