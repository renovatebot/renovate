import urlApi from 'url';
import { logger } from '../../logger';
import * as v2 from './v2';
import * as v3 from './v3';
import { GetReleasesConfig, ReleaseResult } from '../common';

export { id } from './common';

function parseRegistryUrl(
  registryUrl: string
): { feedUrl: string; protocolVersion: number } {
  try {
    const parsedUrl = urlApi.parse(registryUrl);
    let protocolVersion = 2;
    const protolVersionRegExp = /#protocolVersion=(2|3)/;
    const protocolVersionMatch = protolVersionRegExp.exec(parsedUrl.hash);
    if (protocolVersionMatch) {
      parsedUrl.hash = '';
      protocolVersion = Number.parseInt(protocolVersionMatch[1], 10);
    } else if (parsedUrl.pathname.endsWith('.json')) {
      protocolVersion = 3;
    }
    return { feedUrl: urlApi.format(parsedUrl), protocolVersion };
  } catch (e) {
    logger.debug({ e }, `nuget registry failure: can't parse ${registryUrl}`);
    return { feedUrl: registryUrl, protocolVersion: null };
  }
}

export async function getReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult> {
  logger.trace(`nuget.getReleases(${lookupName})`);
  let dep: ReleaseResult = null;
  for (const feed of registryUrls || [v3.getDefaultFeed()]) {
    const { feedUrl, protocolVersion } = parseRegistryUrl(feed);
    if (protocolVersion === 2) {
      dep = await v2.getReleases(feedUrl, lookupName);
    } else if (protocolVersion === 3) {
      const queryUrl = await v3.getQueryUrl(feedUrl);
      if (queryUrl !== null) {
        dep = await v3.getReleases(feedUrl, queryUrl, lookupName);
      }
    }
    if (dep != null) {
      break;
    }
  }
  if (dep === null) {
    logger.debug(
      { lookupName },
      `Dependency lookup failure: not found in all feeds`
    );
  }
  return dep;
}
