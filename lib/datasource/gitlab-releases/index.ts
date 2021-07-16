import URL from 'url';
import * as packageCache from '../../util/cache/package';
import { GitlabHttp } from '../../util/http/gitlab';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { GitlabRelease } from './types';

const gitlabApi = new GitlabHttp();

export const id = 'gitlab-releases';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://gitlab.com'];
export const registryStrategy = 'first';

const cacheNamespace = 'datasource-gitlab-releases';

function getCacheKey(depHost: string, repo: string): string {
  const type = 'tags';
  return `${depHost}:${repo}:${type}`;
}

export async function getReleases({
  registryUrl: depHost,
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(depHost, repo)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const urlEncodedRepo = encodeURIComponent(repo);

  const url = URL.resolve(
    depHost,
    `/api/v4/projects/${urlEncodedRepo}/releases?per_page=100`
  );

  const gitlabReleases = (
    await gitlabApi.getJson<GitlabRelease[]>(url, {
      paginate: true,
    })
  ).body;

  const dependency: ReleaseResult = {
    sourceUrl: URL.resolve(depHost, repo),
    releases: null,
  };
  dependency.releases = gitlabReleases.map(({ tag_name, released_at }) => ({
    version: tag_name,
    gitRef: tag_name,
    releaseTimestamp: released_at,
  }));

  const cacheMinutes = 10;
  await packageCache.set(
    cacheNamespace,
    getCacheKey(depHost, repo),
    dependency,
    cacheMinutes
  );
  return dependency;
}
