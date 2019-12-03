import is from '@sindresorhus/is';
import { getDependency } from './get';
import { getRubygemsOrgDependency } from './get-rubygems-org';
import { PkgReleaseConfig, ReleaseResult } from '../common';

const isDefaultUrl = (url: string): boolean => url.endsWith('rubygems.org');

export async function getPkgReleases({
  lookupName,
  registryUrls,
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  const defaultRegistry = 'https://rubygems.org';
  const registries = is.nonEmptyArray(registryUrls)
    ? registryUrls.filter(url => !isDefaultUrl(url))
    : [];
  registries.unshift(defaultRegistry);

  for (const registry of registries) {
    let pkg: ReleaseResult;
    if (isDefaultUrl(registry)) {
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
