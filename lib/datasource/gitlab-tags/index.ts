import is from '@sindresorhus/is';
import { api } from '../../platform/gitlab/gl-got-wrapper';
import { GetReleasesConfig, ReleaseResult } from '../common';

const { get: glGot } = api;

export const id = 'gitlab-tags';

const cacheNamespace = 'datasource-gitlab';
function getCacheKey(depHost: string, repo: string): string {
  const type = 'tags';
  return `${depHost}:${repo}:${type}`;
}

export async function getPkgReleases({
  registryUrls,
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  // Use registryUrls if present, otherwise default to publid gitlab.com
  const depHost = is.nonEmptyArray(registryUrls)
    ? registryUrls[0].replace(/\/$/, '')
    : 'https://gitlab.com';
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(depHost, repo)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const urlEncodedRepo = encodeURIComponent(repo);

  // tag
  const url = `${depHost}/api/v4/projects/${urlEncodedRepo}/repository/tags?per_page=100`;
  type GlTag = {
    name: string;
  }[];

  const versions = (
    await glGot<GlTag>(url, {
      paginate: true,
    })
  ).body.map(o => o.name);

  // istanbul ignore if
  if (!versions) {
    return null;
  }

  const dependency: ReleaseResult = {
    sourceUrl: `${depHost}/${repo}`,
    releases: null,
  };
  dependency.releases = versions.map(version => ({
    version,
    gitRef: version,
  }));

  const cacheMinutes = 10;
  await renovateCache.set(
    cacheNamespace,
    getCacheKey(depHost, repo),
    dependency,
    cacheMinutes
  );
  return dependency;
}
