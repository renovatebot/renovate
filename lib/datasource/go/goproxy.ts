import pAll from 'p-all';
import { logger } from '../../logger';
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

export async function getReleases(
  config: GetReleasesConfig
): Promise<ReleaseResult | null> {
  const { lookupName } = config;

  const baseUrl = 'https://proxy.golang.org';

  try {
    const versions = await listVersions(baseUrl, lookupName);
    const queue = versions.map((version) => async (): Promise<Release> => {
      try {
        return await versionInfo(baseUrl, lookupName, version);
      } catch (err) {
        if (err?.response?.statusCode !== 410) {
          throw err;
        }
      }
      return { version };
    });
    const releases = await pAll(queue, { concurrency: 5 });
    if (releases.length) {
      return { releases };
    }
  } catch (err) {
    logger.debug({ err }, 'Goproxy error');
  }
  return null;
}

enum GoproxyFallback {
  WhenNotFoundOrGone = ',',
  Always = '|',
}

interface GoproxyHost {
  url: string;
  fallback: GoproxyFallback;
}

export function parseGoproxyString(input: unknown): GoproxyHost[] | null {
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
