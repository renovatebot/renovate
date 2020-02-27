import is from '@sindresorhus/is';
import { api } from '../../platform/gitlab/gl-got-wrapper';
import { logger } from '../../logger';
import { PkgReleaseConfig, ReleaseResult } from '../common';

const { get: glGot } = api;

const cacheNamespace = 'datasource-gitlab';
function getCacheKey(
  depHost: string,
  repo: string,
  lookupType: string
): string {
  const type = lookupType || 'tags';
  return `${depHost}:${repo}:${type}`;
}

export async function getPkgReleases({
  registryUrls,
  lookupName: repo,
  lookupType,
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  // Use registryUrls if present, otherwise default to publid gitlab.com
  const depHost = is.nonEmptyArray(registryUrls)
    ? registryUrls[0].replace(/\/$/, '')
    : 'https://gitlab.com';
  let versions: string[];
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(depHost, repo, lookupType)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const urlEncodedRepo = encodeURIComponent(repo);

  try {
    if (lookupType === 'releases') {
      const url = `${depHost}/api/v4/projects/${urlEncodedRepo}/releases?per_page=100`;
      type GlRelease = {
        tag_name: string;
      }[];

      versions = (
        await glGot<GlRelease>(url, {
          paginate: true,
        })
      ).body.map(o => o.tag_name);
    } else {
      // tag
      const url = `${depHost}/api/v4/projects/${urlEncodedRepo}/repository/tags?per_page=100`;
      type GlTag = {
        name: string;
      }[];

      versions = (
        await glGot<GlTag>(url, {
          paginate: true,
        })
      ).body.map(o => o.name);
    }
  } catch (err) {
    // istanbul ignore next
    logger.debug({ repo, err }, 'Error retrieving from Gitlab');
  }

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
    getCacheKey(depHost, repo, lookupType),
    dependency,
    cacheMinutes
  );
  return dependency;
}
