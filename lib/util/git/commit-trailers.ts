import { isNonEmptyArray, isString } from '@sindresorhus/is';
import { logger } from '../../logger/index.ts';
import { regEx } from '../regex.ts';

const commitTrailerRe = regEx(/^[A-Za-z0-9-]+: [^\r\n]+$/);

/**
 * A valid git trailer is a single-line `Key: value` entry where the key
 * contains only letters, digits and `-`, and the value is non-empty.
 */
export function isValidCommitTrailer(trailer: unknown): trailer is string {
  return isString(trailer) && commitTrailerRe.test(trailer);
}

/**
 * Keep only trailers that are valid single-line `Key: value` entries.
 */
export function filterValidCommitTrailers(trailers: string[]): string[] {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const trailer of trailers) {
    if (isValidCommitTrailer(trailer)) {
      valid.push(trailer);
    } else {
      invalid.push(trailer);
    }
  }
  if (isNonEmptyArray(invalid)) {
    logger.warn(
      { invalid },
      'Ignoring invalid commit trailers (must be a single-line Key: value)',
    );
  }
  return valid;
}
