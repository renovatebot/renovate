import { logger } from '../../logger';
import got from '../../util/got';
import { DatasourceError, ReleaseResult, GetReleasesConfig } from '../common';
import { DATASOURCE_HEX } from '../../constants/data-binary-source';

interface HexRelease {
  html_url: string;
  meta?: { links?: Record<string, string> };
  releases?: { version: string }[];
}

export async function getPkgReleases({
  lookupName,
}: Partial<GetReleasesConfig>): Promise<ReleaseResult | null> {
  // istanbul ignore if
  if (!lookupName) {
    logger.warn('hex lookup failure: No lookupName');
    return null;
  }

  // Get dependency name from lookupName.
  // If the dependency is private lookupName contains organization name as following:
  // hexPackageName:organizationName
  // hexPackageName is used to pass it in hex dep url
  // organizationName is used for accessing to private deps
  const hexPackageName = lookupName.split(':')[0];
  const hexUrl = `https://hex.pm/api/packages/${hexPackageName}`;
  try {
    const response = await got<HexRelease>(hexUrl, {
      responseType: 'json',
      context: { hostType: DATASOURCE_HEX },
    });

    const hexRelease = response.body;

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
      releases: releases.map(({ version }) => ({ version })),
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
