import { logger } from '../../logger';
import got from '../../util/got';
import {
  DatasourceError,
  GetReleasesConfig,
  ReleaseResult,
  Release,
} from '../common';

export const id = 'galaxy';

export async function getPkgReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cacheNamespace = 'datasource-galaxy';
  const cacheKey = lookupName;
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const lookUp = lookupName.split('.');
  const userName = lookUp[0];
  const projectName = lookUp[1];

  const baseUrl = 'https://galaxy.ansible.com/';
  const galaxyAPIUrl =
    baseUrl +
    'api/v1/roles/?owner__username=' +
    userName +
    '&name=' +
    projectName;
  const galaxyProjectUrl = baseUrl + userName + '/' + projectName;
  try {
    let res: any = await got(galaxyAPIUrl, {
      hostType: id,
    });
    if (!res || !res.body) {
      logger.warn(
        { dependency: lookupName },
        `Received invalid crate data from ${galaxyAPIUrl}`
      );
      return null;
    }

    res = res.body;
    const response = JSON.parse(res);

    // istanbul ignore if
    if (response.results.length > 1) {
      logger.warn(
        { dependency: lookupName },
        `Received multiple results from ${galaxyAPIUrl}`
      );
      return null;
    }
    if (response.results.length === 0) {
      logger.warn(
        { dependency: lookupName },
        `Received no results from ${galaxyAPIUrl}`
      );
      return null;
    }

    const resultObject = response.results[0];
    const versions = resultObject.summary_fields.versions;

    const result: ReleaseResult = {
      releases: [],
    };

    result.dependencyUrl = galaxyProjectUrl;
    if (resultObject.github_user && resultObject.github_repo) {
      result.sourceUrl =
        'https://github.com/' +
        resultObject.github_user +
        '/' +
        resultObject.github_repo;
    }

    result.releases = versions.map(
      (version: { name: string; release_date: string }) => {
        const release: Release = {
          version: version.name,
          releaseTimestamp: version.release_date,
        };

        return release;
      }
    );
    const cacheMinutes = 10;
    await renovateCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
    return result;
  } catch (err) {
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new DatasourceError(err);
    }
    return null;
  }
}
