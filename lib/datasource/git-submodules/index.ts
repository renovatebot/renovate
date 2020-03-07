import Git from 'simple-git/promise';
import { URL } from 'url';

import { ReleaseResult, GetReleasesConfig, DigestConfig } from '../common';

export const id = 'git-submodules';

export async function getPkgReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cacheNamespace = 'datasource-git-submodules';
  const cacheKey = `${registryUrls[0]}-${registryUrls[1]}`;
  const cachedResult = await renovateCache.get<ReleaseResult>(
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
  await renovateCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
  return result;
}

export const getDigest = (
  config: DigestConfig,
  newValue?: string
): Promise<string> => new Promise(resolve => resolve(newValue));
