import { parseUrl } from '../../util/url';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { knownFallbackHosts } from './common';
import { getDependency, getDependencyFallback } from './get';
import { getRubygemsOrgDependency } from './get-rubygems-org';

export function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  if (parseUrl(registryUrl)?.hostname === 'rubygems.org') {
    return getRubygemsOrgDependency(lookupName);
  }
  if (knownFallbackHosts.includes(parseUrl(registryUrl)?.hostname)) {
    return getDependencyFallback(lookupName, registryUrl);
  }
  return getDependency(lookupName, registryUrl);
}
