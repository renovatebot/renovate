import pMap from 'p-map';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type {
  BaseProjectResult,
  VersionsDetailResult,
  VersionsProjectResult,
} from './types';

export const id = 'galaxy-collection';
export const defaultRegistryUrls = ['https://galaxy.ansible.com/'];
export const customRegistrySupport = false;

const http = new Http(id);

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cacheNamespace = 'datasource-galaxy-collection';
  const cacheKey = lookupName;
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const [namespace, projectName] = lookupName.split('.');

  const baseUrl = `${registryUrl}api/v2/collections/${namespace}/${projectName}/`;

  try {
    const baseUrlResponse = await http.getJson<BaseProjectResult>(baseUrl);
    if (!baseUrlResponse || !baseUrlResponse.body) {
      logger.warn(
        { dependency: lookupName },
        `Received invalid data from ${baseUrl}`
      );
      return null;
    }

    const baseProject = baseUrlResponse.body;

    const versionsUrl = `${baseUrl}versions/`;
    const versionsUrlResponse = await http.getJson<VersionsProjectResult>(
      versionsUrl
    );
    const versionsProject = versionsUrlResponse.body;

    const releases: Release[] = versionsProject.results.map((value) => {
      const release: Release = {
        version: value.version,
        isDeprecated: baseProject.deprecated,
      };
      return release;
    });

    let newestVersionDetails: VersionsDetailResult;
    // asynchronously get release details
    const enrichedReleases: Release[] = await pMap(
      releases,
      (basicRelease) =>
        http
          .getJson<VersionsDetailResult>(
            `${versionsUrl}${basicRelease.version}/`
          )
          .then(
            (versionDetailResultResponse) => versionDetailResultResponse.body
          )
          .then((versionDetails) => {
            try {
              const release: Release = {
                version: basicRelease.version,
                isDeprecated: basicRelease.isDeprecated,
                downloadUrl: versionDetails.download_url,
                newDigest: versionDetails.artifact.sha256,
                dependencies: versionDetails.metadata.dependencies,
              };

              // save details of the newest release for use on the ReleaseResult object
              if (basicRelease.version === baseProject.latest_version.version) {
                newestVersionDetails = versionDetails;
              }
              return release;
            } catch (err) {
              logger.warn(
                { dependency: lookupName, err },
                `Received invalid data from ${versionsUrl}${basicRelease.version}/`
              );
              return null;
            }
          }),
      { concurrency: 5 } // allow 5 requests at maximum in parallel
    );
    // filter failed versions
    const filteredReleases = enrichedReleases.filter((value) => value != null);
    // extract base information which are only provided on the release from the newest release
    const result: ReleaseResult = {
      releases: filteredReleases,
      sourceUrl: newestVersionDetails?.metadata.repository,
      homepage: newestVersionDetails?.metadata.homepage,
      tags: newestVersionDetails?.metadata.tags,
    };

    const cacheMinutes = 30;
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
