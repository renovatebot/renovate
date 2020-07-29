import { GetReleasesConfig, ReleaseResult } from '../common';
import { getDependencyGem } from './get-gem';
import { getDependencyJson } from './get-json';

function useJsonApi(registryUrl: string): boolean {
  const registryUrlHostname = new URL(registryUrl).hostname;

  // gemfury does not provide a compatible JSON-API
  if (registryUrlHostname === 'gem.fury.io') {
    return false;
  }

  // rubygems.org JSON API is rate-limited, use the non JSON API instead
  if (registryUrlHostname === 'rubygems.org') {
    return false;
  }

  return true;
}

export function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  // prettier-ignore
  if (useJsonApi(registryUrl)) {
    return getDependencyJson({ dependency: lookupName, registry: registryUrl });
  }

  return getDependencyGem({ dependency: lookupName, registry: registryUrl });
}
