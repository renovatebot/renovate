import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { type Http, HttpError } from '../../../util/http/index.ts';
import type { Release, ReleaseResult } from '../types.ts';
import { pageSize } from './common.ts';
import type { AdoptiumJavaResponse, PackageConfig } from './types.ts';

export const adoptiumRegistryUrl = 'https://api.adoptium.net/';

async function getPageReleases(
  http: Http,
  url: string,
  page: number,
): Promise<Release[] | null> {
  const pgUrl = `${url}&page=${page}`;
  try {
    const pgRes = await http.getJsonUnchecked<AdoptiumJavaResponse>(pgUrl);
    return (
      pgRes?.body?.versions?.map(({ semver }) => ({
        version: semver,
      })) ?? null
    );
  } catch (err) {
    if (
      page !== 0 &&
      err instanceof HttpError &&
      err.response?.statusCode === 404
    ) {
      // No more pages
      return null;
    }

    throw err;
  }
}

export async function getAdoptiumReleases(
  http: Http,
  pkgConfig: PackageConfig,
): Promise<ReleaseResult | null> {
  logger.trace({ pkgConfig }, 'fetching Adoptium releases');

  let url = `${adoptiumRegistryUrl}v3/info/release_versions?page_size=${pageSize}&image_type=${pkgConfig.imageType}&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC`;

  if (pkgConfig.architecture) {
    url += `&architecture=${pkgConfig.architecture}`;
  }
  if (pkgConfig.os) {
    url += `&os=${pkgConfig.os}`;
  }

  const result: ReleaseResult = {
    homepage: 'https://adoptium.net',
    releases: [],
  };

  try {
    let page = 0;
    let releases = await getPageReleases(http, url, page);
    while (releases) {
      result.releases.push(...releases);
      if (releases.length !== pageSize || page >= 50) {
        break;
      }
      page += 1;
      releases = await getPageReleases(http, url, page);
    }
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.response?.statusCode !== 404) {
        throw new ExternalHostError(err);
      }
      // 404 is handled by getPageReleases, so if we get here with a non-HTTP error, throw it
      return null;
    }
    throw err;
  }

  return result.releases.length ? result : null;
}
