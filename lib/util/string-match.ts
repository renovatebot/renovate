import is from '@sindresorhus/is';
import { minimatch } from './minimatch';
import { regEx } from './regex';

export type StringMatchPredicate = (s: string) => boolean;

export function isDockerDigest(input: string): boolean {
  return /^sha256:[a-f0-9]{64}$/i.test(input);
}

export function makeRegexOrMinimatchPredicate(
  pattern: string,
): StringMatchPredicate {
  const regExPredicate = configRegexPredicate(pattern);
  if (regExPredicate) {
    return regExPredicate;
  }

  const mm = minimatch(pattern, { dot: true });
  return (x: string): boolean => mm.match(x);
}

export function matchRegexOrMinimatch(input: string, pattern: string): boolean {
  const predicate = makeRegexOrMinimatchPredicate(pattern);
  return predicate ? predicate(input) : false;
}

export function anyMatchRegexOrMinimatch(
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
    !positivePatterns.some((pattern) => matchRegexOrMinimatch(input, pattern))
  ) {
    return false;
  }

  // Every negative pattern must be true to return true
  const negativePatterns = patterns.filter((pattern) =>
    pattern.startsWith('!'),
  );
  if (
    negativePatterns.length &&
    !negativePatterns.every((pattern) => matchRegexOrMinimatch(input, pattern))
  ) {
    return false;
  }

  return true;
}

export const UUIDRegex = regEx(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
);

const configValStart = regEx(/^!?\//);
const configValEnd = regEx(/\/i?$/);

export function isConfigRegex(input: unknown): input is string {
  return (
    is.string(input) && configValStart.test(input) && configValEnd.test(input)
  );
}

function parseConfigRegex(input: string): RegExp | null {
  try {
    const regexString = input
      .replace(configValStart, '')
      .replace(configValEnd, '');
    return input.endsWith('i') ? regEx(regexString, 'i') : regEx(regexString);
  } catch (err) {
    // no-op
  }
  return null;
}

export function configRegexPredicate(
  input: string,
): StringMatchPredicate | null {
  if (isConfigRegex(input)) {
    const configRegex = parseConfigRegex(input);
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
