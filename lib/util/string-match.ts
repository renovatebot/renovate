import { isString } from '@sindresorhus/is';
import { minimatch } from './minimatch.ts';
import { regEx } from './regex.ts';

export type StringMatchPredicate = (s: string) => boolean;

export function isDockerDigest(input: string): boolean {
  return /^sha256:[a-f0-9]{64}$/i.test(input);
}

/**
 * Check if a string is an intentional glob pattern.
 * We treat patterns containing `*`, `?` (wildcards), `{` (brace expansion) or
 * `\` (escape character) as globs.
 * Square brackets `[...]` are deliberately excluded because email addresses
 * (like GitHub bot emails `foo+renovate[bot]@example.com`) contain literal
 * brackets that must not be interpreted as glob character classes.
 */
function isGlobPattern(pattern: string): boolean {
  // Remove the '!' prefix if present (used for negation)
  const cleanPattern = pattern.startsWith('!') ? pattern.slice(1) : pattern;
  // Treat `*`, `?` (wildcards), `{` (brace expansion) and `\` (escape) as glob
  // indicators. `[` is intentionally omitted so literal brackets in emails match
  // exactly.
  return /[*?{\\]/.test(cleanPattern);
}

export function getRegexOrGlobPredicate(pattern: string): StringMatchPredicate {
  const regExPredicate = getRegexPredicate(pattern);
  if (regExPredicate) {
    return regExPredicate;
  }

  // Non-glob patterns may contain literal square brackets, e.g. GitHub bot emails
  // like `foo+renovate[bot]@example.com`. Escape those brackets (and the backslash
  // escape character itself) so minimatch treats them as literal characters instead
  // of glob syntax. Case-sensitivity and all other matching behavior are left to
  // minimatch, unchanged.
  const globPattern = isGlobPattern(pattern)
    ? pattern
    : pattern.replace(/[\\[\]]/g, '\\$&');
  const mm = minimatch(globPattern, { dot: true, nocase: true });
  return (x: string): boolean => mm.match(x);
}

export function matchRegexOrGlob(input: string, pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }
  const predicate = getRegexOrGlobPredicate(pattern);
  return predicate(input);
}

export function matchRegexOrGlobList(
  input: string,
  patterns: string[],
): boolean {
  if (!patterns.length) {
    return false;
  }

  // Return false if there are positive patterns and none match
  const positivePatterns = patterns.filter(
    (pattern) => !pattern.startsWith('!'),
  );
  if (
    positivePatterns.length &&
    !positivePatterns.some((pattern) => matchRegexOrGlob(input, pattern))
  ) {
    return false;
  }

  // Every negative pattern must be true to return true
  const negativePatterns = patterns.filter((pattern) =>
    pattern.startsWith('!'),
  );
  if (
    negativePatterns.length &&
    !negativePatterns.every((pattern) => matchRegexOrGlob(input, pattern))
  ) {
    return false;
  }

  return true;
}

export function anyMatchRegexOrGlobList(
  inputs: string[],
  patterns: string[],
): boolean {
  return inputs.some((input) => matchRegexOrGlobList(input, patterns));
}

export const UUIDRegex = regEx(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
);

const configValStart = regEx(/^!?\//);
const configValEnd = regEx(/\/i?$/);

export function isRegexMatch(input: unknown): input is string {
  return (
    isString(input) && configValStart.test(input) && configValEnd.test(input)
  );
}

function parseRegexMatch(input: string): RegExp | null {
  try {
    const regexString = input
      .replace(configValStart, '')
      .replace(configValEnd, '');
    return input.endsWith('i') ? regEx(regexString, 'i') : regEx(regexString);
  } catch {
    // no-op
  }
  return null;
}

export function getRegexPredicate(input: string): StringMatchPredicate | null {
  if (isRegexMatch(input)) {
    const configRegex = parseRegexMatch(input);
    if (configRegex) {
      const isPositive = !input.startsWith('!');
      return (x: string): boolean => {
        const res = configRegex.test(x);
        return isPositive ? res : !res;
      };
    }
  }
  return null;
}
