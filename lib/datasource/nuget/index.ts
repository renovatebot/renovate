import urlApi from 'url';
import uniqBy from 'lodash/uniqBy';
import { logger } from '../../logger';
import { GetReleasesConfig, ReleaseResult } from '../common';
import * as v2 from './v2';
import * as v3 from './v3';

export { id } from './common';

export const defaultRegistryUrls = [v3.getDefaultFeed()];

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
  for (const feed of registryUrls) {
    const { feedUrl, protocolVersion } = parseRegistryUrl(feed);
    let res: ReleaseResult = null;
    if (protocolVersion === 2) {
      res = await v2.getReleases(feedUrl, lookupName);
    } else if (protocolVersion === 3) {
      const queryUrl = await v3.getQueryUrl(feedUrl);
      if (queryUrl !== null) {
        res = await v3.getReleases(feedUrl, queryUrl, lookupName);
      }
    }
    if (res !== null) {
      if (dep !== null) {
        dep.releases = uniqBy(dep.releases.concat(res.releases), 'version');
      } else {
        dep = res;
      }
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
