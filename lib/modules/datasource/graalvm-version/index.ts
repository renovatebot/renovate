import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl, parsePackage } from './common';
import type { MiseJavaRelease } from './types';

export class GraalvmVersionDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  @cache({
    namespace: `datasource-${datasource}` as const,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl ?? defaultRegistryUrl}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const pkgConfig = parsePackage(packageName);

    logger.trace(
      { registryUrl, packageName, pkgConfig },
      'fetching GraalVM release',
    );

    // Build URL: /jvm/{releaseType}/{os}/{architecture}.json
    // If system detection returns null, we can't fetch - return null
    if (!pkgConfig.os || !pkgConfig.architecture) {
      logger.debug(
        { os: pkgConfig.os, architecture: pkgConfig.architecture },
        'Cannot fetch GraalVM releases without OS and architecture',
      );
      return null;
    }

    const url = joinUrlParts(
      registryUrl ?? defaultRegistryUrl,
      'jvm',
      pkgConfig.releaseType,
      pkgConfig.os,
      `${pkgConfig.architecture}.json`,
    );

    const result: ReleaseResult = {
      homepage: 'https://www.oracle.com/java/graalvm/',
      sourceUrl: 'https://github.com/oracle/graal',
      registryUrl: registryUrl ?? defaultRegistryUrl,
      releases: [],
    };

    try {
      const response = await this.http.getJsonUnchecked<MiseJavaRelease[]>(url);

      if (!response.body) {
        return null;
      }

      // Filter by vendor and image_type
      const filteredReleases = response.body
        .filter((release) => {
          return (
            release.vendor === pkgConfig.vendor &&
            release.image_type === pkgConfig.imageType
          );
        })
        .map((release) => ({
          version: release.version,
        }));

      result.releases.push(...filteredReleases);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.response?.statusCode === 404) {
          logger.debug({ url }, 'GraalVM releases not found (404)');
          return null;
        }
        throw new ExternalHostError(err);
      }
      /* v8 ignore next -- should never happen, all http errors are HttpError */
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}
