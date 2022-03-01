import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { cache } from '../../util/cache/package/decorator';
import { HttpError } from '../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import {
  datasource,
  defaultRegistryUrl,
  getImageType,
  pageSize,
} from './common';
import type { AdoptiumJavaResponse } from './types';

export class AdoptiumJavaDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  private async getPageReleases(
    url: string,
    page: number
  ): Promise<Release[] | null> {
    const pgUrl = `${url}&page=${page}`;
    try {
      const pgRes = await this.http.getJson<AdoptiumJavaResponse>(pgUrl);
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
    key: ({ registryUrl, lookupName }: GetReleasesConfig) =>
      `${registryUrl}:${getImageType(lookupName)}`,
  })
  async getReleases({
    registryUrl,
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const imageType = getImageType(lookupName);
    logger.trace(
      { registryUrl, lookupName, imageType },
      'fetching java release'
    );
    const url = `${registryUrl}v3/info/release_versions?page_size=${pageSize}&image_type=${imageType}&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC&vendor=adoptium`;

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
      // istanbul ignore else: not testable with nock
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
