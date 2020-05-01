import { GetReleasesConfig, ReleaseResult } from '../common';
import { getDependency } from './get';
import { getRubygemsOrgDependency } from './get-rubygems-org';

export async function getReleases({
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
