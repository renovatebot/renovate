import Git from 'simple-git';

import * as packageCache from '../../util/cache/package';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'git-submodules';

export const defaultConfig = {
  pinDigests: false,
};

export async function getReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cacheNamespace = 'datasource-git-submodules';
  const cacheKey = `${registryUrls[0]}-${registryUrls[1]}`;
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const git = Git();
  const newHash = (
    await git.listRemote(['--refs', registryUrls[0], registryUrls[1]])
  )
    .trim()
    .split(/\t/)[0];

  const sourceUrl = new URL(registryUrls[0]);
  sourceUrl.username = '';

  const result = {
    sourceUrl: sourceUrl.href,
    releases: [
      {
        version: newHash,
      },
    ],
  };
  const cacheMinutes = 60;
  await packageCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
  return result;
}

export const getDigest = (
  config: DigestConfig,
  newValue?: string
): Promise<string> => Promise.resolve(newValue);
