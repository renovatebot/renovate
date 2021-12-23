import is from '@sindresorhus/is';
import moo from 'moo';
import pAll from 'p-all';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { regEx } from '../../util/regex';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { GoproxyFallback, getSourceUrl, http } from './common';
import { getDatasource } from './get-datasource';
import * as direct from './releases-direct';
import type { GoproxyItem, VersionInfo } from './types';

const parsedGoproxy: Record<string, GoproxyItem[]> = {};

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

  if (parsedGoproxy[input]) {
    return parsedGoproxy[input];
  }

  const result: GoproxyItem[] = input
    .split(regEx(/([^,|]*(?:,|\|))/))
    .filter(Boolean)
    .map((s) => s.split(/(?=,|\|)/)) // TODO: #12872 lookahead
    .map(([url, separator]) => ({
      url,
      fallback:
        separator === ','
          ? GoproxyFallback.WhenNotFoundOrGone
          : GoproxyFallback.Always,
    }));

  parsedGoproxy[input] = result;
  return result;
}

// https://golang.org/pkg/path/#Match
const lexer = moo.states({
  main: {
    separator: {
      match: /\s*?,\s*?/, // TODO #12870
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

const parsedNoproxy: Record<string, RegExp | null> = {};

export function parseNoproxy(
  input: unknown = process.env.GONOPROXY || process.env.GOPRIVATE
): RegExp | null {
  if (!is.string(input)) {
    return null;
  }
  if (parsedNoproxy[input] !== undefined) {
    return parsedNoproxy[input];
  }
  lexer.reset(input);
  const noproxyPattern = [...lexer].map(({ value }) => value).join('');
  const result = noproxyPattern
    ? regEx(`^(?:${noproxyPattern})(?:/.*)?$`)
    : null;
  parsedNoproxy[input] = result;
  return result;
}

/**
 * Avoid ambiguity when serving from case-insensitive file systems.
 *
 * @see https://golang.org/ref/mod#goproxy-protocol
 */
export function encodeCase(input: string): string {
  return input.replace(regEx(/([A-Z])/g), (x) => `!${x.toLowerCase()}`);
}

export async function listVersions(
  baseUrl: string,
  lookupName: string
): Promise<string[]> {
  const url = `${baseUrl}/${encodeCase(lookupName)}/@v/list`;
  const { body } = await http.get(url);
  return body
    .split(regEx(/\s+/))
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
  logger.trace(`goproxy.getReleases(${lookupName})`);

  const goproxy = process.env.GOPROXY;
  const proxyList = parseGoproxy(goproxy);
  const noproxy = parseNoproxy();

  const cacheNamespaces = 'datasource-go-proxy';
  const cacheKey = `${lookupName}@@${goproxy}@@${noproxy?.toString()}`;
  const cacheMinutes = 60;
  const cachedResult = await packageCache.get<ReleaseResult | null>(
    cacheNamespaces,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult || cachedResult === null) {
    return cachedResult;
  }

  let result: ReleaseResult | null = null;

  if (noproxy?.test(lookupName)) {
    logger.debug(`Fetching ${lookupName} via GONOPROXY match`);
    result = await direct.getReleases(config);
    await packageCache.set(cacheNamespaces, cacheKey, result, cacheMinutes);
    return result;
  }

  for (const { url, fallback } of proxyList) {
    try {
      if (url === 'off') {
        break;
      } else if (url === 'direct') {
        result = await direct.getReleases(config);
        break;
      }

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
        const datasource = await getDatasource(lookupName);
        const sourceUrl = getSourceUrl(datasource);
        result = { releases, sourceUrl };
        break;
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

  await packageCache.set(cacheNamespaces, cacheKey, result, cacheMinutes);
  return result;
}
