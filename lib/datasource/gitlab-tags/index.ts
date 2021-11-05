import * as packageCache from '../../util/cache/package';
import { GitlabHttp } from '../../util/http/gitlab';
import { joinUrlParts } from '../../util/url';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { GitlabTag } from './types';
import { defaultRegistryUrl, getDepHost, getSourceUrl } from './util';

export const id = 'gitlab-tags';
const gitlabApi = new GitlabHttp(id);

export const customRegistrySupport = true;
export const defaultRegistryUrls = [defaultRegistryUrl];
export const registryStrategy = 'first';

const cacheNamespace = 'datasource-gitlab';

function getCacheKey(depHost: string, repo: string): string {
  const type = 'tags';
  return `${depHost}:${repo}:${type}`;
}

export async function getReleases({
  registryUrl,
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const depHost = getDepHost(registryUrl);

  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(depHost, repo)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const urlEncodedRepo = encodeURIComponent(repo);

  // tag
  const url = joinUrlParts(
    depHost,
    `api/v4/projects`,
    urlEncodedRepo,
    `repository/tags?per_page=100`
  );

  const gitlabTags = (
    await gitlabApi.getJson<GitlabTag[]>(url, {
      paginate: true,
    })
  ).body;

  const dependency: ReleaseResult = {
    sourceUrl: getSourceUrl(repo, registryUrl),
    releases: null,
  };
  dependency.releases = gitlabTags.map(({ name, commit }) => ({
    version: name,
    gitRef: name,
    releaseTimestamp: commit?.created_at,
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
