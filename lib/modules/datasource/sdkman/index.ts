import { isEmptyStringOrWhitespace } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { HttpError } from '../../../util/http/index.ts';
import { joinUrlParts, parseUrl } from '../../../util/url.ts';
import { id } from '../../versioning/docker/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';

export class SdkmanDatasource extends Datasource {
  static readonly id = 'sdkman';

  override readonly defaultVersioning = id;

  override readonly defaultRegistryUrls = [
    'https://api.sdkman.io/2/candidates?binaryArch=linuxx64',
  ];

  override readonly caching = true;

  constructor() {
    super(SdkmanDatasource.id);
  }
  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace({ packageName }, 'fetching sdkman release');

    /* v8 ignore next -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const packageUrl = constructPackageUrl(registryUrl, packageName);
    if (packageUrl === null) {
      return null;
    }

    try {
      const response = await this.http.getText(packageUrl);

      const versions = response?.body
        ?.split(',')
        .filter((version) => !isEmptyStringOrWhitespace(version));

      if (versions.length === 0) {
        return null;
      }

      return {
        releases: versions?.map((version) => ({ version: version.trim() })),
      };
    } catch (err) {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        return null;
      }
      throw new ExternalHostError(err);
    }
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${SdkmanDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}

function constructPackageUrl(
  registryUrl: string,
  packageName: string,
): string | null {
  const url = parseUrl(registryUrl);
  if (!url) {
    return null;
  }

  const binaryArch = url.searchParams.get('binaryArch');
  if (!binaryArch?.trim()) {
    throw new Error(`Missing required query parameter: 'binaryArch'`);
  }

  if (binaryArch === null || isEmptyStringOrWhitespace(binaryArch)) {
    throw new Error(
      "Parameter 'binaryArch' is not allowed to be null or blank",
    );
  }

  url.searchParams.delete('binaryArch');

  return joinUrlParts(
    url.toString(),
    packageName,
    binaryArch,
    'versions',
    'all',
  );
}
