import is from '@sindresorhus/is';
import moo from 'moo';
import pAll from 'p-all';
import { logger } from '../../logger';
import * as memCache from '../../util/cache/memory';
import { regEx } from '../../util/regex';
import { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { http } from './common';
import { GoproxyFallback, GoproxyHost, VersionInfo } from './types';

export function encodeCase(input: string): string {
  return input.replace(/([A-Z])/g, (x) => `!${x.toLowerCase()}`);
}

export async function listVersions(
  baseUrl: string,
  lookupName: string
): Promise<string[]> {
  const url = `${baseUrl}/${encodeCase(lookupName)}/@v/list`;
  const { body } = await http.get(url);
  return body
    .split(/\s+/)
    .filter(Boolean)
    .filter((x) => x.indexOf('+') === -1);
}

export async function versionInfo(
  baseUrl: string,
  lookupName: string,
  version: string
): Promise<Release> {
  const url = `${baseUrl}/${encodeCase(lookupName)}/@v/${version}.info`;
  const res = await http.getJson<VersionInfo>(url);

  const result: Release = {
    version: res.body.Version,
  };

  if (res.body.Time) {
    result.releaseTimestamp = res.body.Time;
  }

  return result;
}

/**
 * @example
 * // [
 * //   { url: 'foo', fallback: '|' },
 * //   { url: 'bar', fallback: ',' },
 * //   { url: 'baz', fallback: '|' },
 * // ]
 * parseGoproxy('foo|bar,baz')
 */
export function parseGoproxy(input: unknown): GoproxyHost[] | null {
  if (!input || !is.string(input)) {
    return null;
  }

  const result: GoproxyHost[] = input
    .split(/([^,|]*(?:,|\|))/)
    .filter(Boolean)
    .map((s) => s.split(/(?=,|\|)/))
    .map(([url, separator]) => ({
      url,
      fallback:
        separator === ','
          ? GoproxyFallback.WhenNotFoundOrGone
          : GoproxyFallback.Always,
    }));

  return result.length ? result : null;
}

// https://golang.org/pkg/path/#Match
const pathGlobLexer = {
  main: {
    separator: {
      match: /\s*?,\s*?/,
      value: (_: string) => '|',
    },
    asterisk: {
      match: '*',
      value: (_: string) => '[^\\/]*',
    },
    qmark: {
      match: '?',
      value: (_: string) => '[^\\/]',
    },
    characterRangeOpen: {
      match: '[',
      push: 'characterRange',
      value: (_: string) => '[',
    },
    char: /[^*?\\[\n]/,
    escapedChar: {
      match: /\\./,
      value: (s: string) => s.slice(1),
    },
  },
  characterRange: {
    char: /[^\\\]\n]/,
    escapedChar: {
      match: /\\./,
      value: (s: string) => s.slice(1),
    },
    characterRangeEnd: {
      match: ']',
      pop: 1,
    },
  },
};

export function parseNoproxy(input: unknown): RegExp | null {
  if (!input || !is.string(input)) {
    return null;
  }
  const lexer = moo.states(pathGlobLexer);
  lexer.reset(input);
  const noproxyPattern = [...lexer].map(({ value }) => value).join('');
  return noproxyPattern ? regEx(noproxyPattern) : null;
}

export function getProxyList(
  proxy: string = process.env.GOPROXY,
  noproxy: string = process.env.GONOPROXY || process.env.GOPRIVATE
): GoproxyHost[] {
  const cacheKey = `${proxy}::${noproxy}`;
  const cachedResult = memCache.get<GoproxyHost[]>(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  let result: GoproxyHost[] = [];

  const proxyList = parseGoproxy(proxy);
  if (proxyList) {
    const noproxyRegex = parseNoproxy(noproxy);
    result = proxyList.map((x) => {
      if (noproxyRegex?.test(x.url)) {
        return { ...x, disabled: true };
      }
      return x;
    });
  }

  memCache.set(cacheKey, result);
  return result;
}

export async function getReleases(
  config: GetReleasesConfig
): Promise<ReleaseResult | null> {
  const { lookupName } = config;

  const proxyList = getProxyList();

  for (const { url, fallback, disabled } of proxyList) {
    if (!disabled) {
      try {
        const versions = await listVersions(url, lookupName);
        const queue = versions.map((version) => async (): Promise<Release> => {
          try {
            return await versionInfo(url, lookupName, version);
          } catch (err) {
            return { version };
          }
        });
        const releases = await pAll(queue, { concurrency: 5 });
        if (releases.length) {
          return { releases };
        }
      } catch (err) {
        const statusCode = err?.response?.statusCode;
        const canFallback =
          fallback === GoproxyFallback.Always
            ? true
            : statusCode === 404 || statusCode === 410;
        const msg = canFallback
          ? 'Goproxy error: trying next URL provided with GOPROXY'
          : 'Goproxy error: skipping other URLs provided with GOPROXY';
        logger.debug({ err }, msg);
        if (!canFallback) {
          break;
        }
      }
    }
  }

  return null;
}
