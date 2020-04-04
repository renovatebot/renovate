import { getDependency } from './get';
import { getRubygemsOrgDependency } from './get-rubygems-org';
import { GetReleasesConfig, ReleaseResult } from '../common';

export async function getPkgReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  for (const registry of registryUrls) {
    let pkg: ReleaseResult;
    // prettier-ignore
    if (registry.endsWith('rubygems.org')) { // lgtm [js/incomplete-url-substring-sanitization]
      pkg = await getRubygemsOrgDependency(lookupName);
    } else {
      pkg = await getDependency({ dependency: lookupName, registry });
    }
    if (pkg) {
      return pkg;
    }
  }

  return null;
}
