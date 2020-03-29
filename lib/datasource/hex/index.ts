import { logger } from '../../logger';
import got from '../../util/got';
import { DatasourceError, ReleaseResult, GetReleasesConfig } from '../common';

export const id = 'hex';

interface HexRelease {
  html_url: string;
  meta?: { links?: Record<string, string> };
  releases?: {
    version: string;
    inserted_at?: string;
  }[];
}

export async function getPkgReleases({
  lookupName,
}: Partial<GetReleasesConfig>): Promise<ReleaseResult | null> {
  // Get dependency name from lookupName.
  // If the dependency is private lookupName contains organization name as following:
  // hexPackageName:organizationName
  // hexPackageName is used to pass it in hex dep url
  // organizationName is used for accessing to private deps
  const hexPackageName = lookupName.split(':')[0];
  const hexUrl = `https://hex.pm/api/packages/${hexPackageName}`;
  try {
    const response = await got(hexUrl, {
      json: true,
      hostType: id,
    });

    const hexRelease: HexRelease = response.body;

    if (!hexRelease) {
      logger.warn({ datasource: 'hex', lookupName }, `Invalid response body`);
      return null;
    }

    const { releases = [], html_url: homepage, meta } = hexRelease;

    if (releases.length === 0) {
      logger.debug(`No versions found for ${hexPackageName} (${hexUrl})`); // prettier-ignore
      return null;
    }

    const result: ReleaseResult = {
      releases: releases.map(({ version, inserted_at }) =>
        inserted_at
          ? {
              version,
              releaseTimestamp: inserted_at,
            }
          : { version }
      ),
    };

    if (homepage) {
      result.homepage = homepage;
    }

    if (meta && meta.links && meta.links.Github) {
      result.sourceUrl = hexRelease.meta.links.Github;
    }

    return result;
  } catch (err) {
    const errorData = { lookupName, err };

    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      throw new DatasourceError(err);
    }

    if (err.statusCode === 401) {
      logger.debug(errorData, 'Authorization error');
    } else if (err.statusCode === 404) {
      logger.debug(errorData, 'Package lookup error');
    } else {
      logger.warn(errorData, 'hex lookup failure: Unknown error');
    }
  }

  return null;
}
