import * as utils from '../../platform/bitbucket/utils';
import * as packageCache from '../../util/cache/package';
import { BitbucketHttp } from '../../util/http/bitbucket';
import { ensureTrailingSlash } from '../../util/url';
import { GetReleasesConfig, ReleaseResult } from '../common';

const bitbucketHttp = new BitbucketHttp();

export const id = 'bitbucket-tags';
export const defaultRegistryUrls = ['https://bitbucket.org'];
export const registryStrategy = 'first';

const cacheNamespace = 'datasource-bitbucket';
function getCacheKey(depHost: string, repo: string): string {
  const type = 'tags';
  return `${depHost}:${repo}:${type}`;
}

type BitbucketTag = {
  name: string;
  target?: {
    date?: string;
  };
};

export async function getReleases({
  registryUrl,
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  // fallback to default API endpoint if custom not provided

  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(registryUrl, repo)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const url = `/2.0/repositories/${repo}/refs/tags`;

  const bitbucketTags = (
    await bitbucketHttp.getJson<utils.PagedResult<BitbucketTag>>(url)
  ).body;

  const dependency: ReleaseResult = {
    sourceUrl: `${ensureTrailingSlash(registryUrl)}${repo}`,
    releases: null,
  };
  dependency.releases = bitbucketTags.values.map(({ name, target }) => ({
    version: name,
    gitRef: name,
    releaseTimestamp: target?.date,
  }));

  const cacheMinutes = 10;
  await packageCache.set(
    cacheNamespace,
    getCacheKey(registryUrl, repo),
    dependency,
    cacheMinutes
  );
  return dependency;
}
