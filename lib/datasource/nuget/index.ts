import urlApi from 'url';
import { logger } from '../../logger';
import * as v2 from './v2';
import * as v3 from './v3';
import { PkgReleaseConfig, ReleaseResult } from '../common';

function detectFeedVersion(url: string): 2 | 3 | null {
  try {
    const parsecUrl = urlApi.parse(url);
    // Official client does it in the same way
    if (parsecUrl.pathname.endsWith('.json')) {
      return 3;
    }
    return 2;
  } catch (e) {
    logger.debug({ e }, `nuget registry failure: can't parse ${url}`);
    return null;
  }
}

export async function getPkgReleases({
  lookupName,
  registryUrls,
}: PkgReleaseConfig): Promise<ReleaseResult> {
  logger.trace(`nuget.getPkgReleases(${lookupName})`);
  let dep: ReleaseResult = null;
  for (const feed of registryUrls || [v3.getDefaultFeed()]) {
    const feedVersion = detectFeedVersion(feed);
    if (feedVersion === 2) {
      dep = await v2.getPkgReleases(feed, lookupName);
    } else if (feedVersion === 3) {
      const queryUrl = await v3.getQueryUrl(feed);
      if (queryUrl !== null) {
        dep = await v3.getPkgReleases(feed, queryUrl, lookupName);
      }
    }
    if (dep != null) {
      break;
    }
  }
  if (dep === null) {
    logger.info(
      { lookupName },
      `Dependency lookup failure: not found in all feeds`
    );
  }
  return dep;
}
