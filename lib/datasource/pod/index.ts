import crypto from 'crypto';
import { api } from '../../platform/github/gh-got-wrapper';
import { GetReleasesConfig, ReleaseResult } from '../common';
import { logger } from '../../logger';

export const id = 'pod';

const cacheNamespace = `datasource-${id}`;
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

async function makeRequest<T = unknown>(
  url: string,
  lookupName: string,
  json = true
): Promise<T | null> {
  try {
    const resp = await api.get(url, { json });
    if (resp && resp.body) {
      return resp.body;
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

const githubRegex = /^https:\/\/github\.com\/(?<account>[^/]+)\/(?<repo>[^/]+?)(\.git|\/.*)?$/;

async function getReleasesFromGithub(
  lookupName: string,
  registryUrl: string,
  useShard = false
): Promise<ReleaseResult | null> {
  const match = githubRegex.exec(registryUrl);
  const { account, repo } = (match && match.groups) || {};
  const opts = { account, repo, useShard };
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

function releasesCDNUrl(lookupName: string, registryUrl: string): string {
  const shard = shardParts(lookupName).join('_');
  return `${registryUrl}/all_pods_versions_${shard}.txt`;
}

async function getReleasesFromCDN(
  lookupName: string,
  registryUrl: string
): Promise<ReleaseResult | null> {
  const url = releasesCDNUrl(lookupName, registryUrl);
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

const defaultCDN = 'https://cdn.cocoapods.org';

function isDefaultRepo(url: string): boolean {
  const match = githubRegex.exec(url);
  if (match) {
    const { account, repo } = match.groups || {};
    return (
      account.toLowerCase() === 'cocoapods' && repo.toLowerCase() === 'specs'
    ); // https://github.com/CocoaPods/Specs.git
  }
  return false;
}

export async function getPkgReleases(
  config: GetReleasesConfig
): Promise<ReleaseResult | null> {
  const { lookupName } = config;
  let { registryUrls } = config;
  registryUrls =
    registryUrls && registryUrls.length ? registryUrls : [defaultCDN];

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

  let result: ReleaseResult | null = null;
  for (let idx = 0; !result && idx < registryUrls.length; idx += 1) {
    let registryUrl = registryUrls[idx].replace(/\/+$/, '');

    // In order to not abuse github API limits, query CDN instead
    if (isDefaultRepo(registryUrl)) {
      registryUrl = defaultCDN;
    }

    if (githubRegex.exec(registryUrl)) {
      result = await getReleasesFromGithub(podName, registryUrl);
    } else {
      result = await getReleasesFromCDN(podName, registryUrl);
    }
  }

  if (result) {
    await renovateCache.set(cacheNamespace, podName, result, cacheMinutes);
  }

  return result;
}
