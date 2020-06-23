import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as globalCache from '../../util/cache/global';
import { Http } from '../../util/http';
import { GetReleasesConfig, Release, ReleaseResult } from '../common';

export const id = 'crate';

const http = new Http(id);

export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cacheNamespace = 'datasource-crate';
  const cacheKey = lookupName;
  const cachedResult = await globalCache.get<ReleaseResult>(
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
    const lines = (await http.get(crateUrl)).body
      .split('\n') // break into lines
      .map((line) => line.trim()) // remove whitespace
      .filter((line) => line.length !== 0) // remove empty lines
      .map((line) => JSON.parse(line)); // parse
    const result: ReleaseResult = {
      releases: [],
    };
    result.releases = lines
      .map((version: { vers: string; yanked: boolean }) => {
        const release: Release = {
          version: version.vers,
        };
        if (version.yanked) {
          release.isDeprecated = true;
        }
        return release;
      })
      .filter((release) => release.version);
    if (!result.releases.length) {
      return null;
    }
    const cacheMinutes = 10;
    await globalCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
    return result;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.debug({ lookupName }, `Dependency lookup failure: not found`);
      logger.debug({ err }, 'Crate lookup error');
      return null;
    }
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new ExternalHostError(err);
    }
    logger.warn({ err, lookupName }, 'crates.io lookup failure: Unknown error');
    return null;
  }
}
