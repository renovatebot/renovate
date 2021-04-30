import is from '@sindresorhus/is';
import moo from 'moo';
import pAll from 'p-all';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { http } from './common';
import { GoproxyFallback, GoproxyItem, VersionInfo } from './types';

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
  input: string = process.env.GOPROXY
): GoproxyItem[] {
  if (!is.string(input)) {
    return [];
  }

  let result: GoproxyItem[] = input
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

  // Ignore hosts after any keyword
  for (let idx = 0; idx < result.length; idx += 1) {
    const { url } = result[idx];
    if (['off', 'direct'].includes(url)) {
      result = result.slice(0, idx);
      break;
    }
  }

  return result;
}

// https://golang.org/pkg/path/#Match
const lexer = moo.states({
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
});

export function parseNoproxy(
  input: unknown = process.env.GONOPROXY || process.env.GOPRIVATE
): RegExp | null {
  if (!is.string(input)) {
    return null;
  }
  lexer.reset(input);
  const noproxyPattern = [...lexer].map(({ value }) => value).join('');
  return noproxyPattern ? regEx(`^(?:${noproxyPattern})$`) : null;
}

/**
 * Avoid ambiguity when serving from case-insensitive file systems.
 *
 * @see https://golang.org/ref/mod#goproxy-protocol
 */
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

export async function getReleases(
  config: GetReleasesConfig
): Promise<ReleaseResult | null> {
  const { lookupName } = config;

  const noproxy = parseNoproxy();
  if (noproxy?.test(lookupName)) {
    logger.debug(`Skipping ${lookupName} via GONOPROXY match`);
    return null;
  }

  const proxyList = parseGoproxy();

  for (const { url, fallback } of proxyList) {
    try {
      const versions = await listVersions(url, lookupName);
      const queue = versions.map((version) => async (): Promise<Release> => {
        try {
          return await versionInfo(url, lookupName, version);
        } catch (err) {
          logger.trace({ err }, `Can't obtain data from ${url}`);
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

  return null;
}
