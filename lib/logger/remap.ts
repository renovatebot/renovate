import type { LogLevelString } from 'bunyan';
import type { StringMatchPredicate } from '../util/string-match';
import { getRegexOrGlobPredicate } from '../util/string-match';
import type { LogLevelRemap } from './types';

let globalRemaps: LogLevelRemap[] | undefined;
let repositoryRemaps: LogLevelRemap[] | undefined;

let matcherCache = new WeakMap<LogLevelRemap, StringMatchPredicate>();

function match(remap: LogLevelRemap, input: string): boolean {
  const { matchMessage: pattern } = remap;
  let matchFn = matcherCache.get(remap);
  if (!matchFn) {
    matchFn = getRegexOrGlobPredicate(pattern);
    matcherCache.set(remap, matchFn);
  }

  return matchFn(input);
}

export function getRemappedLevel(msg: string): LogLevelString | null {
  if (repositoryRemaps) {
    for (const remap of repositoryRemaps) {
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
