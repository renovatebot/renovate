import type { LogLevelString } from 'bunyan';
import {
  StringMatchPredicate,
  makeRegexOrMinimatchPredicate,
} from '../util/string-match';
import type { LogLevelRemap } from './types';

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

export function getRemappedLevel(
  msg: string,
  logLevelRemaps: LogLevelRemap[] | undefined,
): LogLevelString | null {
  if (!logLevelRemaps) {
    return null;
  }

  for (let idx = logLevelRemaps.length - 1; idx >= 0; idx -= 1) {
    const logLevelRemap = logLevelRemaps[idx];
    if (match(logLevelRemap, msg)) {
      return logLevelRemap.newLogLevel;
    }
  }

  return null;
}

export function resetRemapMatcherCache(): void {
  matcherCache = new WeakMap();
}
