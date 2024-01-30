import type { LogLevelString } from 'bunyan';
import { re2 } from '../expose.cjs';
import { minimatch } from '../util/minimatch';
import type { LogLevelRemap } from './types';

let RegEx: RegExpConstructor;
if (!process.env.RENOVATE_X_IGNORE_RE2) {
  try {
    const RE2 = re2();
    // Test if native is working
    new RE2('.*').exec('test');
    RegEx = RE2;
  } catch (err) {
    RegEx = RegExp;
  }
}

let matcherCache = new WeakMap<LogLevelRemap, (input: string) => boolean>();

function match(remap: LogLevelRemap, input: string): boolean {
  const { matchMessage: pattern } = remap;
  let matchFn = matcherCache.get(remap);
  if (!matchFn) {
    if (
      pattern.length > 2 &&
      pattern.startsWith('/') &&
      pattern.endsWith('/')
    ) {
      try {
        const regex = new RegEx(pattern.slice(1, -1));
        matchFn = (input) => regex.test(input);
      } catch (err) {
        matchFn = () => false;
      }
    } else {
      const mm = minimatch(pattern, { dot: true });
      matchFn = (input) => mm.match(input);
    }

    matcherCache.set(remap, matchFn);
  }

  return matchFn(input);
}

export function getRemappedLevel(
  logLevelRemaps: LogLevelRemap[] | null,
  msg: string,
): LogLevelString | null {
  if (!logLevelRemaps) {
    return null;
  }

  for (const logLevelRemap of logLevelRemaps) {
    if (match(logLevelRemap, msg)) {
      return logLevelRemap.newLogLevel;
    }
  }

  return null;
}

export function resetRemapMatcherCache(): void {
  matcherCache = new WeakMap();
}
