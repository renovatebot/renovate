import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http } from '../../util/http';
import * as hexVersioning from '../../versioning/hex';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'hex';
export const defaultRegistryUrls = ['https://hex.pm/'];
export const customRegistrySupport = false;
export const defaultVersioning = hexVersioning.id;

const http = new Http(id);

interface HexRelease {
  html_url: string;
  meta?: { links?: Record<string, string> };
  releases?: {
    version: string;
    inserted_at?: string;
  }[];
}

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  // Get dependency name from lookupName.
  // If the dependency is private lookupName contains organization name as following:
  // hexPackageName:organizationName
  // hexPackageName is used to pass it in hex dep url
  // organizationName is used for accessing to private deps
  const hexPackageName = lookupName.split(':')[0];
  const hexUrl = `${registryUrl}api/packages/${hexPackageName}`;
  try {
    const response = await http.getJson<HexRelease>(hexUrl);

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

    if (meta?.links?.Github) {
      result.sourceUrl = hexRelease.meta.links.Github;
    }

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
