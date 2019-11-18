import crypto from 'crypto';
import { api } from '../../platform/github/gh-got-wrapper';
import { PkgReleaseConfig, ReleaseResult } from '../common';
import { logger } from '../../logger';

const cacheNamespace = 'cocoapods';
const cacheMinutes = 30;

function shardParts(lookupName: string): string[] {
  return crypto
    .createHash('md5')
    .update(lookupName)
    .digest('hex')
    .slice(0, 3)
    .split('');
}

function releasesGithubUrl(
  lookupName: string,
  opts: { account: string; repo: string; useShard: boolean }
): string {
  const { useShard, account, repo } = opts;
  const prefix = 'https://api.github.com/repos';
  const shard = shardParts(lookupName).join('/');
  const suffix = useShard ? `${shard}/${lookupName}` : lookupName;
  return `${prefix}/${account}/${repo}/contents/Specs/${suffix}`;
}

async function makeRequest<T = any>(
  url: string,
  lookupName: string,
  json = true
): Promise<T> {
  try {
    const resp = await api.get(url, { json });
    if (resp && resp.body) {
      return resp.body as any;
    }
  } catch (err) {
    const errorData = { lookupName, err };

    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      logger.warn({ lookupName, err }, `CocoaPods registry failure`);
      throw new Error('registry-failure');
    }

    if (err.statusCode === 401) {
      logger.debug(errorData, 'Authorization error');
    } else if (err.statusCode === 404) {
      logger.debug(errorData, 'Package lookup error');
    } else {
      logger.warn(errorData, 'CocoaPods lookup failure: Unknown error');
    }
  }

  return null;
}

async function getReleasesFromGithub(
  lookupName,
  registryUrl,
  useShard = false
): Promise<ReleaseResult | null> {
  const match = registryUrl
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .match(/https:\/\/github\.com\/(?<account>[^/]+)\/(?<repo>[^/]+)$/);
  const groups = (match && match.groups) || {};
  const opts = { ...groups, useShard };
  const url = releasesGithubUrl(lookupName, opts);
  const resp = await makeRequest<{ name: string }[]>(url, lookupName);
  if (resp) {
    const releases = resp.map(({ name }) => ({ version: name }));
    return { releases };
  }

  if (!useShard) {
    return getReleasesFromGithub(lookupName, registryUrl, true);
  }

  return null;
}

function releasesCDNUrl(lookupName: string): string {
  const shard = shardParts(lookupName).join('_');
  return `https://cdn.cocoapods.org/all_pods_versions_${shard}.txt`;
}

async function getReleasesFromCDN(
  lookupName: string
): Promise<ReleaseResult | null> {
  const url = releasesCDNUrl(lookupName);
  const resp = await makeRequest<string>(url, lookupName, false);
  if (resp) {
    const lines = resp.split('\n');
    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const [name, ...versions] = line.split('/');
      if (name === lookupName.replace(/\/.*$/, '')) {
        const releases = versions.map(version => ({ version }));
        return { releases };
      }
    }
  }
  return null;
}

export async function getPkgReleases(
  config: Partial<PkgReleaseConfig>
): Promise<ReleaseResult | null> {
  const { registryUrls = [], lookupName } = config;

  if (!lookupName) {
    logger.debug(config, `CocoaPods: invalid lookup name`);
    return null;
  }

  const podName = lookupName.replace(/\/.*$/, '');

  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    podName
  );
  /* istanbul ignore next line */
  if (cachedResult) {
    logger.debug(`CocoaPods: Return cached result for ${podName}`);
    return cachedResult;
  }

  let result = await getReleasesFromCDN(podName);
  for (let idx = 0; !result && idx < registryUrls.length; idx += 1) {
    const registryUrl = registryUrls[idx];
    result = await getReleasesFromGithub(podName, registryUrl);
  }

  if (result) {
    await renovateCache.set(cacheNamespace, podName, result, cacheMinutes);
    return result;
  }
  return null;
}
