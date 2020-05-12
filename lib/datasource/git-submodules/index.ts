import { URL } from 'url';
import Git from 'simple-git/promise';

import { logger } from '../../logger';
import * as globalCache from '../../util/cache/global';
import { DigestConfig, GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'git-submodules';

export async function getReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cacheNamespace = 'datasource-git-submodules';
  const cacheKey = `${registryUrls[0]}-${registryUrls[1]}`;
  const cachedResult = await globalCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const git = Git();
  try {
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
    await globalCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
    return result;
  } catch (err) {
    logger.debug({ err }, `Git-SubModules lookup error in ${lookupName}`);
  }
  return null;
}

export const getDigest = (
  config: DigestConfig,
  newValue?: string
): Promise<string> => new Promise((resolve) => resolve(newValue));
