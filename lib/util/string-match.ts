import is from '@sindresorhus/is';
import { minimatch } from './minimatch';
import { regEx } from './regex';

export type StringMatchPredicate = (s: string) => boolean;

export function isDockerDigest(input: string): boolean {
  return /^sha256:[a-f0-9]{64}$/i.test(input);
}

export function makeRegexOrMinimatchPredicate(
  pattern: string,
): StringMatchPredicate | null {
  if (pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/')) {
    try {
      const regex = regEx(pattern.slice(1, -1));
      return (x: string): boolean => regex.test(x);
    } catch (err) {
      return null;
    }
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
): boolean | null {
  return patterns.some((pattern) => matchRegexOrMinimatch(input, pattern));
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
