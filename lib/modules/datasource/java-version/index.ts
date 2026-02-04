import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { HttpError } from '../../../util/http/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import {
  datasource,
  defaultRegistryUrl,
  pageSize,
  parsePackage,
} from './common.ts';
import type { AdoptiumJavaResponse } from './types.ts';

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

  private async _getReleases({
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

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${datasource}`,
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
