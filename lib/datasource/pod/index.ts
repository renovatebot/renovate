import crypto from 'crypto';
import { HOST_DISABLED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { GithubHttp } from '../../util/http/github';
import type { HttpError } from '../../util/http/types';
import { regEx } from '../../util/regex';
import { massageGithubUrl } from '../metadata';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'pod';

export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://cdn.cocoapods.org'];
export const registryStrategy = 'hunt';

const cacheNamespace = `datasource-${id}`;
const cacheMinutes = 30;

const githubHttp = new GithubHttp(id);
const http = new Http(id);

const enum URLFormatOptions {
  WithShardWithSpec,
  WithShardWithoutSpec,
  WithSpecsWithoutShard,
  WithoutSpecsWithoutShard,
}

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
  opts: {
    hostURL: string;
    account: string;
    repo: string;
    useShard: boolean;
    useSpecs: boolean;
  }
): string {
  const { hostURL, account, repo, useShard, useSpecs } = opts;
  const prefix =
    hostURL && hostURL !== 'https://github.com'
      ? `${hostURL}/api/v3/repos`
      : 'https://api.github.com/repos';
  const shard = shardParts(lookupName).join('/');
  // `Specs` in the pods repo URL is a new requirement for legacy support also allow pod repo URL without `Specs`
  const lookupNamePath = useSpecs ? `Specs/${lookupName}` : lookupName;
  const shardPath = useSpecs
    ? `Specs/${shard}/${lookupName}`
    : `${shard}/${lookupName}`;
  const suffix = useShard ? shardPath : lookupNamePath;
  return `${prefix}/${account}/${repo}/contents/${suffix}`;
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

const githubRegex = regEx(
  /(?<hostURL>(^https:\/\/[a-zA-z0-9-.]+))\/(?<account>[^/]+)\/(?<repo>[^/]+?)(\.git|\/.*)?$/
);

async function getReleasesFromGithub(
  lookupName: string,
  opts: { hostURL: string; account: string; repo: string },
  useShard = true,
  useSpecs = true,
  urlFormatOptions = URLFormatOptions.WithShardWithSpec
): Promise<ReleaseResult | null> {
  const url = releasesGithubUrl(lookupName, { ...opts, useShard, useSpecs });
  const resp = await requestGithub<{ name: string }[]>(url, lookupName);
  if (resp) {
    const releases = resp.map(({ name }) => ({ version: name }));
    return { releases };
  }

  // iterating through enum to support different url formats
  switch (urlFormatOptions) {
    case URLFormatOptions.WithShardWithSpec:
      return getReleasesFromGithub(
        lookupName,
        opts,
        true,
        false,
        URLFormatOptions.WithShardWithoutSpec
      );
    case URLFormatOptions.WithShardWithoutSpec:
      return getReleasesFromGithub(
        lookupName,
        opts,
        false,
        true,
        URLFormatOptions.WithSpecsWithoutShard
      );
    case URLFormatOptions.WithSpecsWithoutShard:
      return getReleasesFromGithub(
        lookupName,
        opts,
        false,
        false,
        URLFormatOptions.WithoutSpecsWithoutShard
      );
    case URLFormatOptions.WithoutSpecsWithoutShard:
    default:
      return null;
  }
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
      if (name === lookupName.replace(regEx(/\/.*$/), '')) {
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
  const podName = lookupName.replace(regEx(/\/.*$/), '');

  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    registryUrl + podName
  );

  // istanbul ignore if
  if (cachedResult !== undefined) {
    logger.trace(`CocoaPods: Return cached result for ${podName}`);
    return cachedResult;
  }

  let baseUrl = registryUrl.replace(regEx(/\/+$/), '');
  baseUrl = massageGithubUrl(baseUrl);
  // In order to not abuse github API limits, query CDN instead
  if (isDefaultRepo(baseUrl)) {
    [baseUrl] = defaultRegistryUrls;
  }

  let result: ReleaseResult | null = null;
  const match = githubRegex.exec(baseUrl);
  if (match) {
    const { hostURL, account, repo } = match?.groups || {};
    const opts = { hostURL, account, repo };
    result = await getReleasesFromGithub(podName, opts);
  } else {
    result = await getReleasesFromCDN(podName, baseUrl);
  }

  await packageCache.set(cacheNamespace, podName, result, cacheMinutes);

  return result;
}
