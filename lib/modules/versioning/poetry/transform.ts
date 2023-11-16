import semver from 'semver';
import { RANGE_COMPARATOR_PATTERN, VERSION_PATTERN } from './patterns';

interface LetterTag {
  letter: string;
  number: string;
}

function parseLetterTag(letter?: string, number?: string): LetterTag | null {
  if (letter !== undefined) {
    // apply the same normalizations as poetry
    const spellings: Record<string, string> = {
      alpha: 'a',
      beta: 'b',
      c: 'rc',
      pre: 'rc',
      preview: 'rc',
      r: 'post',
      rev: 'post',
    };
    return {
      letter: spellings[letter] || letter,
      number: number ?? '0',
    };
  }
  if (letter === undefined && number !== undefined) {
    return { letter: 'post', number };
  }
  return null;
}

function notEmpty(s: string): boolean {
  return s !== '';
}

/**
 * Parse versions like poetry.core.masonry.version.Version does (union of SemVer
 * and PEP440, with normalization of certain prerelease tags), and emit in SemVer
 * format. NOTE: this silently discards the epoch field in PEP440 versions, as
 * it has no equivalent in SemVer.
 */
export function poetry2semver(
  poetry_version: string,
  padRelease = true,
): string | null {
  const matchGroups = VERSION_PATTERN.exec(poetry_version)?.groups;
  if (!matchGroups) {
    return null;
  }
  // trim leading zeros from valid numbers
  const releaseParts = matchGroups.release
    .split('.')
    .map((segment) => parseInt(segment, 10));
  while (padRelease && releaseParts.length < 3) {
    releaseParts.push(0);
  }
  const pre = parseLetterTag(matchGroups.pre_l, matchGroups.pre_n);
  const post = matchGroups.post_n1
    ? parseLetterTag(undefined, matchGroups.post_n1)
    : parseLetterTag(matchGroups.post_l, matchGroups.post_n);
  const dev = parseLetterTag(matchGroups.dev_l, matchGroups.dev_n);

  const parts = [releaseParts.map((num) => num.toString()).join('.')];
  if (pre !== null) {
    parts.push(`-${pre.letter}.${pre.number}`);
  }
  if (post !== null) {
    parts.push(`-${post.letter}.${post.number}`);
  }
  if (dev !== null) {
    parts.push(`-${dev.letter}.${dev.number}`);
  }

  return parts.join('');
}

/** Reverse normalizations applied by poetry2semver */
export function semver2poetry(version?: string): string | null {
  if (!version) {
    return null;
  }
  const s = semver.parse(version);
  if (!s) {
    return null;
  }
  const spellings: Record<string, string> = {
    a: 'alpha',
    b: 'beta',
    c: 'rc',
    dev: 'alpha',
  };
  s.prerelease = s.prerelease.map((letter) => spellings[letter] ?? letter);
  return s.format();
}

/**
 * Translate a poetry-style version range to npm format
 *
 * This function works like cargo2npm, but it doesn't
 * add a '^', because poetry treats versions without operators as
 * exact versions.
 */
export function poetry2npm(input: string): string {
  // replace commas with spaces, then split at valid semver comparators
  const chunks = input
    .split(',')
    .map((str) => str.trim())
    .filter(notEmpty)
    .join(' ')
    .split(RANGE_COMPARATOR_PATTERN);
  // do not pad versions with zeros in a range
  const transformed = chunks
    .map((chunk) => poetry2semver(chunk, false) ?? chunk)
    .join('')
    .replace(/===/, '=');
  return transformed;
}

/**
 * Translate an npm-style version range to poetry format
 *
 * NOTE: This function is largely copied from cargo versioning code.
 * Poetry uses commas (like in cargo) instead of spaces (like in npm)
 * for AND operation.
 */
export function npm2poetry(range: string): string {
  // apply poetry-style normalizations to versions embedded in range string
  // (i.e. anything that is not a range operator, potentially surrounded by whitespace)
  const transformedRange = range
    .split(RANGE_COMPARATOR_PATTERN)
    .map((chunk) => semver2poetry(chunk) ?? chunk)
    .join('');

  // Note: this doesn't remove the ^
  const res = transformedRange
    .split(' ')
    .map((str) => str.trim())
    .filter(notEmpty);

  const operators = ['^', '~', '=', '>', '<', '<=', '>='];
  for (let i = 0; i < res.length - 1; i += 1) {
    if (operators.includes(res[i])) {
      const newValue = res[i] + ' ' + res[i + 1];
      res.splice(i, 2, newValue);
    }
  }
  return res.join(', ').replace(/\s*,?\s*\|\|\s*,?\s*/g, ' || ');
}
