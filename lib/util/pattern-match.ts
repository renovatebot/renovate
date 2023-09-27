import { minimatch } from './minimatch';
import { configRegexPredicate, isConfigRegex } from './regex';

export function matchBlobOrRegex(input: string, matcher: string): boolean {
  // Check if pattern is regex
  if (isConfigRegex(matcher)) {
    const autodiscoveryPred = configRegexPredicate(matcher);
    if (!autodiscoveryPred) {
      throw new Error(`Failed to parse regex pattern "${matcher}"`);
    }
    return autodiscoveryPred(input);
  }
  // else use minimatch
  return minimatch(matcher, { nocase: true }).match(input);
}

export function matchBlobOrRegexArray(
  input: string,
  matches: string[]
): boolean {
  return filterBlobOrRegexArray([input], matches).length > 0;
}

export function filterBlobOrRegexArray(
  inputs: string[],
  matches: string[]
): string[] {
  if (!matches.length) {
    return [];
  }
  const positiveMatches = matches.filter((m) => !m.startsWith('!'));
  const negativeMatches = matches.filter((m) => m.startsWith('!'));
  return inputs.filter(
    (input) =>
      (positiveMatches.length === 0 ||
        positiveMatches.some((m) => matchBlobOrRegex(input, m))) &&
      negativeMatches.every((m) => matchBlobOrRegex(input, m))
  );
}
