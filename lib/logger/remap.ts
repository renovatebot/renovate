import type { LogLevelString } from 'bunyan';
import type { StringMatchPredicate } from '../util/string-match.ts';
import { getRegexOrGlobPredicate } from '../util/string-match.ts';
import type { LogLevelRemap } from './types.ts';

let globalRemaps: LogLevelRemap[] | undefined;
let repositoryRemaps: LogLevelRemap[] | undefined;

let matcherCache = new WeakMap<LogLevelRemap, StringMatchPredicate>();

function match(remap: LogLevelRemap, input: string): boolean {
  const { matchMessage: pattern } = remap;
  let matchFn = matcherCache.get(remap);
  // v8 ignore else -- TODO: add test #40625
  if (!matchFn) {
    matchFn = getRegexOrGlobPredicate(pattern);
    matcherCache.set(remap, matchFn);
  }

  return matchFn(input);
}

export function getRemappedLevel(msg: string): LogLevelString | null {
  if (repositoryRemaps) {
    for (const remap of repositoryRemaps) {
      // v8 ignore else -- TODO: add test #40625
      if (match(remap, msg)) {
        return remap.newLogLevel;
      }
    }
  }

  if (globalRemaps) {
    for (const remap of globalRemaps) {
      if (match(remap, msg)) {
        return remap.newLogLevel;
      }
    }
  }

  return null;
}

function resetMatcherCache(): void {
  matcherCache = new WeakMap();
}

export function setGlobalLogLevelRemaps(
  remaps: LogLevelRemap[] | undefined,
): void {
  globalRemaps = remaps;
}

export function resetGlobalLogLevelRemaps(): void {
  globalRemaps = undefined;
  resetMatcherCache();
}

export function setRepositoryLogLevelRemaps(
  remaps: LogLevelRemap[] | undefined,
): void {
  repositoryRemaps = remaps;
}

export function resetRepositoryLogLevelRemaps(): void {
  repositoryRemaps = undefined;
  resetMatcherCache();
}
