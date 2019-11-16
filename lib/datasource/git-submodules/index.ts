import Git from 'simple-git/promise';
import { URL } from 'url';

import { ReleaseResult, PkgReleaseConfig, DigestConfig } from '../common';
import { logger } from '../../logger';

export async function getPkgReleases({
  lookupName,
  registryUrls,
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  const git = Git();
  try {
    const newHash = (await git.listRemote([
      '--refs',
      registryUrls[0],
      registryUrls[1],
    ]))
      .trim()
      .split(/\t/)[0];

    const sourceUrl = new URL(registryUrls[0]);
    sourceUrl.username = '';

    return {
      sourceUrl: sourceUrl.href,
      releases: [
        {
          version: newHash,
        },
      ],
    };
  } catch (err) {
    logger.debug(`Error looking up tags in ${lookupName}`);
  }
  return null;
}

export const getDigest = (
  config: DigestConfig,
  newValue?: string
): Promise<string> => new Promise(resolve => resolve(newValue));
