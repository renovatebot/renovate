import { CONFIG_VALIDATION } from '../constants/error-messages';
import { logger } from '../logger';

let RegEx: RegExpConstructor;

try {
  // eslint-disable-next-line
  const RE2 = require('re2');
  // Test if native is working
  new RE2('.*').exec('test');
  logger.debug('Using RE2 as regex engine');
  RegEx = RE2;
} catch (err) {
  logger.warn({ err }, 'RE2 not usable, falling back to RegExp');
  RegEx = RegExp;
}

export function regEx(pattern: string, flags?: string): RegExp {
  try {
    return new RegEx(pattern, flags);
  } catch (err) {
    const error = new Error(CONFIG_VALIDATION);
    error.configFile = pattern;
    error.validationError = `Invalid regular expression: ${pattern}`;
    throw error;
  }
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
