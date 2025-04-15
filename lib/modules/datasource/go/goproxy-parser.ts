import is from '@sindresorhus/is';
import moo from 'moo';
import * as memCache from '../../../util/cache/memory';
import { getEnv } from '../../../util/env';
import { regEx } from '../../../util/regex';
import type { GoproxyItem } from './types';

/**
 * Parse `GOPROXY` to the sequence of url + fallback strategy tags.
 *
 * @example
 * parseGoproxy('foo.example.com|bar.example.com,baz.example.com')
 * // [
 * //   { url: 'foo.example.com', fallback: '|' },
 * //   { url: 'bar.example.com', fallback: ',' },
 * //   { url: 'baz.example.com', fallback: '|' },
 * // ]
 *
 * @see https://golang.org/ref/mod#goproxy-protocol
 */
export function parseGoproxy(
  input: string | undefined = getEnv().GOPROXY,
): GoproxyItem[] {
  if (!is.string(input)) {
    return [];
  }

  const cacheKey = `goproxy::${input}`;
  const cachedResult = memCache.get<GoproxyItem[]>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result: GoproxyItem[] = input
    .split(regEx(/([^,|]*(?:,|\|))/))
    .filter(Boolean)
    .map((s) => s.split(/(?=,|\|)/)) // TODO: #12872 lookahead
    .map(([url, separator]) => ({
      url,
      fallback: separator === ',' ? ',' : '|',
    }));

  memCache.set(cacheKey, result);
  return result;
}

// https://golang.org/pkg/path/#Match
const noproxyLexer = moo.states({
  main: {
    separator: {
      match: /\s*?,\s*?/, // TODO #12870
      value: (_: string) => '|',
    },
    asterisk: {
      match: '*',
      value: (_: string) => '[^/]*',
    },
    qmark: {
      match: '?',
      value: (_: string) => '[^/]',
    },
    characterRangeOpen: {
      match: '[',
      push: 'characterRange',
      value: (_: string) => '[',
    },
    trailingSlash: {
      match: /\/$/,
      value: (_: string) => '',
    },
    char: {
      match: /[^*?\\[\n]/,
      value: (s: string) => s.replace(regEx('\\.', 'g'), '\\.'),
    },
    escapedChar: {
      match: /\\./, // TODO #12870
      value: (s: string) => s.slice(1),
    },
  },
  characterRange: {
    char: /[^\\\]\n]/, // TODO #12870
    escapedChar: {
      match: /\\./, // TODO #12870
      value: (s: string) => s.slice(1),
    },
    characterRangeEnd: {
      match: ']',
      pop: 1,
    },
  },
});

export function parseNoproxy(
  input: unknown = (() => {
    const env = getEnv();
    return env.GONOPROXY ?? env.GOPRIVATE;
  })(),
): RegExp | null {
  if (!is.string(input)) {
    return null;
  }

  const cacheKey = `noproxy::${input}`;
  const cachedResult = memCache.get<RegExp | null>(cacheKey);
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  const noproxyPattern = [...noproxyLexer.reset(input)]
    .map(({ value }) => value)
    .join('');

  const result = noproxyPattern
    ? regEx(`^(?:${noproxyPattern})(?:/.*)?$`)
    : null;

  memCache.set(cacheKey, result);
  return result;
}
