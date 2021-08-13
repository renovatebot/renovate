import { parseUrl } from '../../util/url';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { getDependency } from './get';
import { getGitHubPackagesDependency } from './get-github-packages';
import { getRubygemsOrgDependency } from './get-rubygems-org';

export function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  if (parseUrl(registryUrl)?.hostname == 'rubygems.org') {
    return getRubygemsOrgDependency(lookupName);
  }
  if (parseUrl(registryUrl)?.hostname === 'rubygems.pkg.github.com') {
    return getGitHubPackagesDependency(lookupName, registryUrl);
  }
  return getDependency(lookupName, registryUrl);
}
