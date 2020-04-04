import is from '@sindresorhus/is';
import { getDependency } from './get';
import { getRubygemsOrgDependency } from './get-rubygems-org';
import { GetReleasesConfig, ReleaseResult } from '../common';

export async function getReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const defaultRegistry = 'https://rubygems.org';
  const registries = is.nonEmptyArray(registryUrls)
    ? registryUrls
    : [defaultRegistry];

  for (const registry of registries) {
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
