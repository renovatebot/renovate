import moo from 'moo';
import pAll from 'p-all';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { http } from './common';

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

interface VersionInfo {
  Version: string;
  Time?: string;
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

enum GoproxyFallback {
  WhenNotFoundOrGone = ',',
  Always = '|',
}

interface GoproxyHost {
  url: string;
  fallback: GoproxyFallback;
  disabled?: true;
}

export function parseGoproxy(input: unknown): GoproxyHost[] | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const split = input.split(/(,|\|)/);
  const result: GoproxyHost[] = [];
  while (split.length) {
    const [url, separator] = split.splice(0, 2);
    const fallback =
      separator === ','
        ? GoproxyFallback.WhenNotFoundOrGone
        : GoproxyFallback.Always;
    result.push({ url, fallback });
  }

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
  if (!input || typeof input !== 'string') {
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
  const proxyList = parseGoproxy(proxy);
  if (!proxyList) {
    return [];
  }

  const noproxyRegex = parseNoproxy(noproxy);

  const result: GoproxyHost[] = proxyList.map((x) => {
    if (noproxyRegex?.test(x.url)) {
      return { ...x, disabled: true };
    }
    return x;
  });

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
        logger.debug({ err }, 'Goproxy error');
        const statusCode = err?.response?.statusCode;
        if (
          fallback === GoproxyFallback.WhenNotFoundOrGone &&
          statusCode !== 404 &&
          statusCode !== 410
        ) {
          break;
        }
      }
    }
  }

  return null;
}
