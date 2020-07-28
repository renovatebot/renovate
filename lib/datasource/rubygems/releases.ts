import { GetReleasesConfig, ReleaseResult } from '../common';
import { getDependencyGem } from './get-gem';
import { getDependencyJson } from './get-json';

// Some registries don't provide a JSON API
function useJsonApi(registryUrl: string): boolean {
  if (registryUrl.includes('gem.fury.io')) {
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
