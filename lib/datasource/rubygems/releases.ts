import type { GetReleasesConfig, ReleaseResult } from '../types';
import { getDependency } from './get';
import { getGitHubPackagesDependency } from './get-github-packages';
import { getRubygemsOrgDependency } from './get-rubygems-org';

export function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  // prettier-ignore
  if (registryUrl.endsWith('rubygems.org')) { // lgtm [js/incomplete-url-substring-sanitization]
    return getRubygemsOrgDependency(lookupName);
  }
  if (new URL(registryUrl).hostname === 'rubygems.pkg.github.com') {
    return getGitHubPackagesDependency(lookupName, registryUrl);
  }
  return getDependency(lookupName, registryUrl);
}
