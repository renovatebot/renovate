import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { GitlabHttp } from '../../util/http/gitlab';
import { joinUrlParts } from '../../util/url';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import type { GitlabCommit, GitlabTag } from './types';
import { defaultRegistryUrl, getDepHost, getSourceUrl } from './util';

export const id = 'gitlab-tags';
const gitlabApi = new GitlabHttp(id);

export const customRegistrySupport = true;
export const defaultRegistryUrls = [defaultRegistryUrl];
export const registryStrategy = 'first';

const cacheNamespace = 'datasource-gitlab';

function getCacheKey(depHost: string, repo: string, type = 'tags'): string {
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

/**
 * gitlab.getDigest
 *
 * This function will simply return the latest commit hash for the configured repository.
 */
export async function getDigest(
  { lookupName: repo, registryUrl }: Partial<DigestConfig>,
  newValue?: string
): Promise<string | null> {
  const depHost = getDepHost(registryUrl);

  const cachedResult = await packageCache.get<string>(
    cacheNamespace,
    getCacheKey(depHost, repo, 'commit')
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const urlEncodedRepo = encodeURIComponent(repo);
  let digest: string;

  try {
    if (newValue) {
      const url = joinUrlParts(
        depHost,
        `api/v4/projects`,
        urlEncodedRepo,
        `repository/commits/`,
        newValue
      );
      const gitlabCommits = await gitlabApi.getJson<GitlabCommit>(url);
      digest = gitlabCommits.body.id;
    } else {
      const url = joinUrlParts(
        depHost,
        `api/v4/projects`,
        urlEncodedRepo,
        `repository/commits?per_page=1`
      );
      const gitlabCommits = await gitlabApi.getJson<GitlabCommit[]>(url);
      digest = gitlabCommits.body[0].id;
    }
  } catch (err) {
    logger.debug(
      { gitlabRepo: repo, err, registryUrl },
      'Error getting latest commit from Gitlab repo'
    );
  }

  if (!digest) {
    return null;
  }

  const cacheMinutes = 10;
  await packageCache.set(
    cacheNamespace,
    getCacheKey(registryUrl, repo, 'commit'),
    digest,
    cacheMinutes
  );
  return digest;
}
