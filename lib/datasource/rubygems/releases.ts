import is from '@sindresorhus/is';
import { PkgReleaseConfig, ReleaseResult } from '../common';

import { getDependency } from './get';
import { getRubygemsOrgDependency } from './get-rubygems-org';

export async function getPkgReleases({
  lookupName,
  registryUrls,
}: PkgReleaseConfig): Promise<ReleaseResult> {
  const registries = is.nonEmptyArray(registryUrls) ? registryUrls : [];

  for (const registry of registries) {
    let pkg: ReleaseResult;
    if (registry.endsWith('rubygems.org')) {
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
