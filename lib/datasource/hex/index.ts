import { logger } from '../../logger';
import got from '../../util/got';
import { ReleaseResult, PkgReleaseConfig } from '../common';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';

interface HexRelease {
  html_url: string;
  meta?: { links?: Record<string, string> };
  releases?: { version: string }[];
}

export async function getPkgReleases({
  lookupName,
}: Partial<PkgReleaseConfig>): Promise<ReleaseResult | null> {
  // istanbul ignore if
  if (!lookupName) {
    logger.warn('hex lookup failure: No lookupName');
    return null;
  }

  // Get dependency name from lookupName.
  // If the dependency is private lookupName contains organization name as following:
  // depName:organizationName
  // depName is used to pass it in hex dep url
  // organizationName is used for accessing to private deps
  const depName = lookupName.split(':')[0];
  const hexUrl = `https://hex.pm/api/packages/${depName}`;
  try {
    const response = await got(hexUrl, {
      json: true,
      hostType: 'hex',
    });

    const hexRelease: HexRelease = response.body;

    if (!hexRelease) {
      logger.warn({ depName }, `Invalid response body`);
      return null;
    }

    const { releases = [], html_url: homepage, meta } = hexRelease;

    if (releases.length === 0) {
      logger.info(`No versions found for ${depName} (${hexUrl})`); // prettier-ignore
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
    const errorData = { depName, err };

    if (
      err.statusCode === 429 ||
      (err.statusCode >= 500 && err.statusCode < 600)
    ) {
      logger.warn({ lookupName, err }, `hex.pm registry failure`);
      throw new Error(DATASOURCE_FAILURE);
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
