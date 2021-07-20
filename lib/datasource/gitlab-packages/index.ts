import URL from 'url';
import * as packageCache from '../../util/cache/package';
import { GitlabHttp } from '../../util/http/gitlab';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { GitlabPackage } from './types';

const gitlabApi = new GitlabHttp();

export const id = 'gitlab-package';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://gitlab.com'];
export const registryStrategy = 'first';

const cacheNamespace = 'datasource-gitlab';

function getCacheKey(depHost: string, lookupName: string): string {
  const type = 'packages';
  return `${depHost}:${lookupName}:${type}`;
}

export async function getReleases({
  registryUrl: depHost,
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(depHost, lookupName)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const packageName = lookupName.split('/-/').pop();
  const repo = lookupName.slice(0, -1 * (packageName.length + '/-/'.length));

  const urlEncodedPackageName = encodeURIComponent(packageName);
  const urlEncodedRepo = encodeURIComponent(repo);

  // tag
  const url = URL.resolve(
    depHost,
    `/api/v4/projects/${urlEncodedRepo}/packages?package_name=${urlEncodedPackageName}&per_page=100`
  );

  const gitlabPackage = (
    await gitlabApi.getJson<GitlabPackage[]>(url, {
      paginate: true,
    })
  ).body;

  const dependency: ReleaseResult = {
    sourceUrl: URL.resolve(depHost, repo),
    releases: null,
  };
  dependency.releases = gitlabPackage.map(({ version, created_at }) => ({
    version,
    releaseTimestamp: created_at,
  }));

  const cacheMinutes = 10;
  await packageCache.set(
    cacheNamespace,
    getCacheKey(depHost, lookupName),
    dependency,
    cacheMinutes
  );
  return dependency;
}
