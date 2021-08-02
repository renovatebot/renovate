import { GitlabHttp } from '../../util/http/gitlab';
import * as url from '../../util/url';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { GitlabPackage } from './types';

const gitlabApi = new GitlabHttp();

export const id = 'gitlab-packages';
export const customRegistrySupport = true;
export const registryStrategy = 'first';
export const defaultVersioning = 'loose';
export const caching = true;

function getGitlabPackageApiUrl(registryUrl, lookupName): string {
  const parsedRegistryUrl = url.parseUrl(registryUrl);
  const packageName = encodeURIComponent(lookupName);

  const server = parsedRegistryUrl.origin;
  const project = encodeURIComponent(parsedRegistryUrl.pathname.substring(1)); // remove leading /

  return url.resolveBaseUrl(
    server,
    `/api/v4/projects/${project}/packages?package_name=${packageName}&per_page=100`
  );
}

export async function getReleases({
  registryUrl,
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const gitlabPackageApiUrl = getGitlabPackageApiUrl(registryUrl, lookupName);

  const gitlabPackage = (
    await gitlabApi.getJson<GitlabPackage[]>(gitlabPackageApiUrl, {
      paginate: true,
    })
  ).body;

  const dependency: ReleaseResult = {
    releases: null,
  };
  dependency.releases = gitlabPackage.map(({ version, created_at }) => ({
    version,
    releaseTimestamp: created_at,
  }));

  return dependency;
}
