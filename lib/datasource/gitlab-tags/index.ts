import is from '@sindresorhus/is';
import { api } from '../../platform/gitlab/gl-got-wrapper';
import { logger } from '../../logger';
import { GetReleasesConfig, ReleaseResult } from '../common';

const { get: glGot } = api;

export const id = 'gitlab-tags';

const cacheNamespace = 'datasource-gitlab';
function getCacheKey(depHost: string, repo: string): string {
  const type = 'tags';
  return `${depHost}:${repo}:${type}`;
}

type GitlabTag = {
  name: string;
  commit?: {
    created_at?: string;
  };
};

export async function getPkgReleases({
  registryUrls,
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  // Use registryUrls if present, otherwise default to publid gitlab.com
  const depHost = is.nonEmptyArray(registryUrls)
    ? registryUrls[0].replace(/\/$/, '')
    : 'https://gitlab.com';
  let gitlabTags: GitlabTag[];
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(depHost, repo)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const urlEncodedRepo = encodeURIComponent(repo);

  try {
    // tag
    const url = `${depHost}/api/v4/projects/${urlEncodedRepo}/repository/tags?per_page=100`;

    gitlabTags = (
      await glGot<GitlabTag[]>(url, {
        paginate: true,
      })
    ).body;
  } catch (err) {
    // istanbul ignore next
    logger.debug({ repo, err }, 'Error retrieving from Gitlab');
  }

  // istanbul ignore if
  if (!gitlabTags) {
    return null;
  }

  const dependency: ReleaseResult = {
    sourceUrl: `${depHost}/${repo}`,
    releases: null,
  };
  dependency.releases = gitlabTags.map(({ name, commit }) => ({
    version: name,
    gitRef: name,
    releaseTimestamp: commit?.created_at,
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
