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

/**
 * Split a commit message into body and trailing trailer lines.
 * The trailer block is the final paragraph when every line in it is a valid
 * `Key: value` trailer (same shape we accept for `commitTrailers`).
 */
export function splitCommitMessage(message: string): {
  body: string;
  trailers: string[];
} {
  // Trim a single trailing newline often left by editors / git log %B
  const normalized = message.replace(regEx(/\n$/), '');
  if (!normalized) {
    return { body: '', trailers: [] };
  }

  const paragraphs = normalized.split(regEx(/\n\n+/));
  const last = paragraphs.at(-1)!;
  const lines = last.split('\n');
  if (isNonEmptyArray(lines) && lines.every(isValidCommitTrailer)) {
    return {
      body: paragraphs.slice(0, -1).join('\n\n'),
      trailers: lines,
    };
  }
  return { body: normalized, trailers: [] };
}
