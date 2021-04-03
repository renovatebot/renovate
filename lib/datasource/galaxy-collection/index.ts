import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export const id = 'galaxy-collections';
export const defaultRegistryUrls = ['https://galaxy.ansible.com/'];
export const customRegistrySupport = false;

const http = new Http(id);

interface BaseProjectResult {
  versions_url: string;
  deprecated: boolean;
  latest_version: {
    version: string;
  };
}

interface VersionsProjectResult {
  results: Versions[];
}

interface VersionsDetailResult {
  download_url: string;
  artifact: {
    filename: string;
    size: bigint;
    sha256: string;
  };
  metadata: {
    homepage: string;
    tags: Record<string, string>;
    dependencies: Record<string, string>;
    repository: string;
  };
}

interface Versions {
  version: string;
  href: string;
}

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

  const lookUp = lookupName.split('.');
  const namespace = lookUp[0];
  const projectName = lookUp[1];

  const baseUrl = `${registryUrl}api/v2/collections/${namespace}/${projectName}/`;

  try {
    const baseUrlResponse: any = await http.get(baseUrl);
    if (!baseUrlResponse || !baseUrlResponse.body) {
      logger.warn(
        { dependency: lookupName },
        `Received invalid data from ${baseUrl}`
      );
      return null;
    }

    const baseProject: BaseProjectResult = JSON.parse(baseUrlResponse.body);

    const versionsUrl = `${baseUrl}versions/`;
    const versionsUrlResponse: any = await http.get(versionsUrl);
    if (!versionsUrlResponse || !versionsUrlResponse.body) {
      logger.warn(
        { dependency: lookupName },
        `Received invalid data from ${baseUrl}versions/`
      );
      return null;
    }

    const versionsProject: VersionsProjectResult = JSON.parse(
      versionsUrlResponse.body
    );

    const releases: Release[] = versionsProject.results.map((value) => {
      const release: Release = {
        version: value.version,
        isDeprecated: baseProject.deprecated,
      };
      return release;
    });

    let newestVersionDetails: VersionsDetailResult;
    // asynchronously get release details
    const enrichedReleases: Release[] = await Promise.all(
      releases.map(async (basicRelease) => {
        // get release details from API
        const versionDetailUrl = `${versionsUrl}${basicRelease.version}/`;
        const versionsDetailUrlResponse: any = await http.get(versionDetailUrl);
        if (!versionsDetailUrlResponse || !versionsDetailUrlResponse.body) {
          logger.warn(
            { dependency: lookupName },
            `Received invalid data from ${versionDetailUrl}`
          );
          return null;
        }

        const versionDetails: VersionsDetailResult = JSON.parse(
          versionsDetailUrlResponse.body
        );
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
      })
    );

    // extract base information which are only provided on the release from the newest release
    const result: ReleaseResult = {
      releases: enrichedReleases,
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
