import { logger } from '../../logger';
import got from '../../util/got';
import { PkgReleaseConfig, ReleaseResult, Release } from '../common';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';

export async function getPkgReleases({
  lookupName,
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  if (!lookupName) {
    return null;
  }

  const cacheNamespace = 'datasource-cargo';
  const cacheKey = lookupName;
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const len = lookupName.length;
  let path: string;
  // Ignored because there is no way to test this without hitting up GitHub API
  /* istanbul ignore next */
  if (len === 1) {
    path = '1/' + lookupName;
  } else if (len === 2) {
    path = '2/' + lookupName;
  } else if (len === 3) {
    path = '3/' + lookupName[0] + '/' + lookupName;
  } else {
    path =
      lookupName.slice(0, 2) + '/' + lookupName.slice(2, 4) + '/' + lookupName;
  }
  const baseUrl =
    'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';
  const crateUrl = baseUrl + path;
  try {
    let res: any = await got(crateUrl, {
      hostType: 'cargo',
    });
    if (!res || !res.body) {
      logger.warn(
        { dependency: lookupName },
        `Received invalid crate data from ${crateUrl}`
      );
      return null;
    }
    res = res.body;
    res = res.split('\n');
    res = res.map(line => line.trim()).filter(line => line.length !== 0);
    if (res.length === 0) {
      logger.warn(
        { dependency: lookupName },
        `Received empty list from ${crateUrl}`
      );
      return null;
    }
    // Filter empty lines (takes care of trailing \n)
    res = res.map(JSON.parse);
    if (res[0].name !== lookupName) {
      logger.warn(
        { dependency: lookupName },
        `Received invalid crate name from ${crateUrl}`
      );
      return null;
    }
    if (!res[0].vers) {
      logger.warn(
        { dependency: lookupName },
        `Recieved invalid data (vers field doesn't exist) from ${crateUrl}`
      );
      return null;
    }
    const result: ReleaseResult = {
      releases: [],
    };
    result.releases = res.map((version: { vers: string; yanked: boolean }) => {
      const release: Release = {
        version: version.vers,
      };
      if (version.yanked) {
        release.isDeprecated = true;
      }
      return release;
    });

    const cacheMinutes = 10;
    await renovateCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
    return result;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ lookupName }, `Dependency lookup failure: not found`);
      logger.debug({ err }, 'Crate lookup error');
      return null;
    }
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      logger.warn({ lookupName, err }, `cargo crates.io registry failure`);
      throw new Error(DATASOURCE_FAILURE);
    }
    logger.warn(
      { err, lookupName },
      'cargo crates.io lookup failure: Unknown error'
    );
    return null;
  }
}
