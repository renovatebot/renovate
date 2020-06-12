import { GetReleasesConfig, ReleaseResult } from '../common';
import { getJenkinsPluginDependency } from './get';

export async function getReleases({
  lookupName
}: GetReleasesConfig): Promise<ReleaseResult | null> {
    let pkg: ReleaseResult = await getJenkinsPluginDependency(lookupName);
    if (pkg) {
      return pkg;
    }

  return null;
}
