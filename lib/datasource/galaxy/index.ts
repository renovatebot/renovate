import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export const id = 'galaxy';
export const defaultRegistryUrls = ['https://galaxy.ansible.com/'];
export const customRegistrySupport = false;

const http = new Http(id);

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cacheNamespace = 'datasource-galaxy';
  const cacheKey = lookupName;
  const cachedResult = await packageCache.get<ReleaseResult>(
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

  const galaxyAPIUrl =
    registryUrl +
    'api/v1/roles/?owner__username=' +
    userName +
    '&name=' +
    projectName;
  const galaxyProjectUrl = registryUrl + userName + '/' + projectName;
  try {
    let res: any = await http.get(galaxyAPIUrl);
    if (!res || !res.body) {
      logger.warn(
        { dependency: lookupName },
        `Received invalid data from ${galaxyAPIUrl}`
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
      logger.info(
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
    const { github_user: user = null, github_repo: repo = null } = resultObject;
    if (typeof user === 'string' && typeof repo === 'string') {
      result.sourceUrl = `https://github.com/${user}/${repo}`;
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
    await packageCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
    return result;
  } catch (err) {
    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new ExternalHostError(err);
    }
    throw err;
  }
}
