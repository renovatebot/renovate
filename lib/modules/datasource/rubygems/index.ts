import { Marshal } from '@qnighy/marshal';
import type { ZodError } from 'zod';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { AsyncResult, Result } from '../../../util/result';
import { getQueryString, joinUrlParts, parseUrl } from '../../../util/url';
import * as rubyVersioning from '../../versioning/ruby';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { getV1Releases } from './common';
import { RubygemsHttp } from './http';
import { MetadataCache } from './metadata-cache';
import { GemInfo, MarshalledVersionInfo } from './schema';
import { VersionsEndpointCache } from './versions-endpoint-cache';

function unlessServerSide<
  T extends NonNullable<unknown>,
  E extends NonNullable<unknown>,
>(err: E, cb: () => AsyncResult<T, E>): AsyncResult<T, E> {
  if (err instanceof HttpError && err.response?.statusCode) {
    const code = err.response.statusCode;
    if (code >= 500 && code <= 599) {
      return AsyncResult.err(err);
    }
  }
  return cb();
}

export class RubyGemsDatasource extends Datasource {
  static readonly id = 'rubygems';

  private metadataCache: MetadataCache;

  constructor() {
    super(RubyGemsDatasource.id);
    this.http = new RubygemsHttp(RubyGemsDatasource.id);
    this.versionsEndpointCache = new VersionsEndpointCache(this.http);
    this.metadataCache = new MetadataCache(this.http);
  }

  override readonly defaultRegistryUrls = ['https://rubygems.org'];

  override readonly defaultVersioning = rubyVersioning.id;

  override readonly registryStrategy = 'hunt';

  private readonly versionsEndpointCache: VersionsEndpointCache;

  @cache({
    namespace: `datasource-${RubyGemsDatasource.id}`,
    key: ({ packageName, registryUrl }: GetReleasesConfig) =>
      // TODO: types (#22198)
      `releases:${registryUrl!}:${packageName}`,
    cacheable: ({ registryUrl }: GetReleasesConfig) => {
      const registryHostname = parseUrl(registryUrl)?.hostname;
      return registryHostname === 'rubygems.org';
    },
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const registryHostname = parseUrl(registryUrl)?.hostname;

    let result: AsyncResult<ReleaseResult, Error | string>;
    if (registryHostname === 'rubygems.org') {
      result = Result.wrap(
        this.versionsEndpointCache.getVersions(registryUrl, packageName),
      ).transform((versions) =>
        this.metadataCache.getRelease(registryUrl, packageName, versions),
      );
    } else if (
      registryHostname === 'rubygems.pkg.github.com' ||
      registryHostname === 'gitlab.com'
    ) {
      result = this.getReleasesViaDeprecatedAPI(registryUrl, packageName);
    } else {
      result = getV1Releases(this.http, registryUrl, packageName)
        .catch((err) =>
          unlessServerSide(err, () =>
            this.getReleasesViaInfoEndpoint(registryUrl, packageName),
          ),
        )
        .catch((err) =>
          unlessServerSide(err, () =>
            this.getReleasesViaDeprecatedAPI(registryUrl, packageName),
          ),
        );
    }

    const { val, err } = await result.unwrap();
    if (val) {
      return val;
    }

    if (err instanceof Error) {
      this.handleGenericErrors(err);
    }

    logger.debug({ packageName, registryUrl }, `Rubygems fetch error: ${err}`);
    return null;
  }

  private getReleasesViaInfoEndpoint(
    registryUrl: string,
    packageName: string,
  ): AsyncResult<ReleaseResult, Error | ZodError> {
    const url = joinUrlParts(registryUrl, '/info', packageName);
    return Result.wrap(this.http.get(url))
      .transform(({ body }) => body)
      .parse(GemInfo);
  }

  private getReleasesViaDeprecatedAPI(
    registryUrl: string,
    packageName: string,
  ): AsyncResult<ReleaseResult, Error | ZodError> {
    const path = joinUrlParts(registryUrl, `/api/v1/dependencies`);
    const query = getQueryString({ gems: packageName });
    const url = `${path}?${query}`;
    const bufPromise = this.http.getBuffer(url);
    return Result.wrap(bufPromise).transform(({ body }) =>
      MarshalledVersionInfo.safeParse(Marshal.parse(body)),
    );
  }
}
