import { ReleaseResult, GetReleasesConfig } from '../common';
import * as gitRefs from '../git-refs';

export const id = 'git-tags';

const cacheNamespace = 'git-tags';
const cacheMinutes = 10;

export async function getPkgReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    lookupName
  );
  /* istanbul ignore next line */
  if (cachedResult) {
    return cachedResult;
  }
  const filterByTags = '--tags';
  // fetch remote tags
  const result = await gitRefs.getPkgReleases({ lookupName, filterByTags });

  await renovateCache.set(cacheNamespace, lookupName, result, cacheMinutes);

  return result;
}
