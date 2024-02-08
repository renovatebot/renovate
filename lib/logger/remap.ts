import type { LogLevelString } from 'bunyan';
import {
  StringMatchPredicate,
  makeRegexOrMinimatchPredicate,
} from '../util/string-match';
import type { LogLevelRemap } from './types';

let globalRemaps: LogLevelRemap[] | undefined;
let repositoryRemaps: LogLevelRemap[] | undefined;

let matcherCache = new WeakMap<LogLevelRemap, StringMatchPredicate>();

function match(remap: LogLevelRemap, input: string): boolean {
  const { matchMessage: pattern } = remap;
  let matchFn = matcherCache.get(remap);
  if (!matchFn) {
    matchFn = makeRegexOrMinimatchPredicate(pattern) ?? (() => false);
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

export function resetMatcherCache(): void {
  matcherCache = new WeakMap();
}

export function setGlobalLogLevelRemaps(
  remaps: LogLevelRemap[] | undefined,
): void {
  globalRemaps = remaps;
}

export function resetGlobalLogLevelRemaps(): void {
  globalRemaps = undefined;
  matcherCache = new WeakMap();
}

export function setRepositoryLogLevelRemaps(
  remaps: LogLevelRemap[] | undefined,
): void {
  repositoryRemaps = remaps;
}

export function resetRepositoryLogLevelRemaps(): void {
  repositoryRemaps = undefined;
  matcherCache = new WeakMap();
}
