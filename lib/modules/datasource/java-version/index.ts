import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import {
  datasource,
  defaultRegistryUrl,
  pageSize,
  parsePackage,
} from './common';
import type { AdoptiumJavaResponse } from './types';

export class JavaVersionDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  private async getPageReleases(
    url: string,
    page: number,
  ): Promise<Release[] | null> {
    const pgUrl = `${url}&page=${page}`;
    try {
      const pgRes =
        await this.http.getJsonUnchecked<AdoptiumJavaResponse>(pgUrl);
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

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const pkgConfig = parsePackage(packageName);
    logger.trace(
      { registryUrl, packageName, pkgConfig },
      'fetching java release',
    );
    let url = `${registryUrl}v3/info/release_versions?page_size=${pageSize}&image_type=${pkgConfig.imageType}&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC`;

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
      let releases = await this.getPageReleases(url, page);
      while (releases) {
        result.releases.push(...releases);
        if (releases.length !== pageSize || page >= 50) {
          break;
        }
        page += 1;
        releases = await this.getPageReleases(url, page);
      }
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.response?.statusCode !== 404) {
          throw new ExternalHostError(err);
        }
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}
