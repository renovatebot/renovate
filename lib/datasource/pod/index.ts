import crypto from 'crypto';
import { HOST_DISABLED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { GithubHttp } from '../../util/http/github';
import type { HttpError } from '../../util/http/types';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'pod';

export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://cdn.cocoapods.org'];
export const registryStrategy = 'hunt';

const cacheNamespace = `datasource-${id}`;
const cacheMinutes = 30;

const githubHttp = new GithubHttp();
const http = new Http(id);

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

function handleError(lookupName: string, err: HttpError): void {
  const errorData = { lookupName, err };

  const statusCode = err.response?.statusCode;
  if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
    logger.warn({ lookupName, err }, `CocoaPods registry failure`);
    throw new ExternalHostError(err);
  }

  if (statusCode === 401) {
    logger.debug(errorData, 'Authorization error');
  } else if (statusCode === 404) {
    logger.debug(errorData, 'Package lookup error');
  } else if (err.message === HOST_DISABLED) {
    // istanbul ignore next
    logger.trace(errorData, 'Host disabled');
  } else {
    logger.warn(errorData, 'CocoaPods lookup failure: Unknown error');
  }
}

async function requestCDN(
  url: string,
  lookupName: string
): Promise<string | null> {
  try {
    const resp = await http.get(url);
    if (resp?.body) {
      return resp.body;
    }
  } catch (err) {
    handleError(lookupName, err);
  }

  return null;
}

async function requestGithub<T = unknown>(
  url: string,
  lookupName: string
): Promise<T | null> {
  try {
    const resp = await githubHttp.getJson<T>(url);
    if (resp?.body) {
      return resp.body;
    }
  } catch (err) {
    handleError(lookupName, err);
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
  const { account, repo } = match?.groups || {};
  const opts = { account, repo, useShard };
  const url = releasesGithubUrl(lookupName, opts);
  const resp = await requestGithub<{ name: string }[]>(url, lookupName);
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
  const resp = await requestCDN(url, lookupName);
  if (resp) {
    const lines = resp.split('\n');
    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const [name, ...versions] = line.split('/');
      if (name === lookupName.replace(/\/.*$/, '')) {
        const releases = versions.map((version) => ({ version }));
        return { releases };
      }
    }
  }
  return null;
}

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

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const podName = lookupName.replace(/\/.*$/, '');

  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    registryUrl + podName
  );

  // istanbul ignore if
  if (cachedResult !== undefined) {
    logger.trace(`CocoaPods: Return cached result for ${podName}`);
    return cachedResult;
  }

  let baseUrl = registryUrl.replace(/\/+$/, '');

  // In order to not abuse github API limits, query CDN instead
  if (isDefaultRepo(baseUrl)) {
    [baseUrl] = defaultRegistryUrls;
  }

  let result: ReleaseResult | null = null;
  if (githubRegex.exec(baseUrl)) {
    result = await getReleasesFromGithub(podName, baseUrl);
  } else {
    result = await getReleasesFromCDN(podName, baseUrl);
  }

  await packageCache.set(cacheNamespace, podName, result, cacheMinutes);

  return result;
}
