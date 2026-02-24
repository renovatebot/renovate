import { Marshal } from '@qnighy/marshal';
import type { ZodError } from 'zod/v3';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { Http, HttpError } from '../../../util/http/index.ts';
import { AsyncResult, Result } from '../../../util/result.ts';
import { getQueryString, joinUrlParts, parseUrl } from '../../../util/url.ts';
import * as rubyVersioning from '../../versioning/ruby/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { getV1Releases } from './common.ts';
import { MetadataCache } from './metadata-cache.ts';
import { GemInfo, MarshalledVersionInfo } from './schema.ts';
import { VersionsEndpointCache } from './versions-endpoint-cache.ts';

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

export class RubygemsDatasource extends Datasource {
  static readonly id = 'rubygems';

  private metadataCache: MetadataCache;

  constructor() {
    super(RubygemsDatasource.id);
    this.http = new Http(RubygemsDatasource.id);
    this.versionsEndpointCache = new VersionsEndpointCache(this.http);
    this.metadataCache = new MetadataCache(this.http);
  }

  override readonly defaultRegistryUrls = ['https://rubygems.org'];

  override readonly defaultVersioning = rubyVersioning.id;

  override readonly registryStrategy = 'hunt';

  private readonly versionsEndpointCache: VersionsEndpointCache;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `created_at` field in the results.';
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The source URL is determined from the `source_code_uri` field in the results.';

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
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

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const registryHostname = parseUrl(config.registryUrl)?.hostname;
    return withCache(
      {
        namespace: `datasource-${RubygemsDatasource.id}`,
        // TODO: types (#22198)
        key: `releases:${config.registryUrl!}:${config.packageName}`,
        fallback: true,
        cacheable: registryHostname === 'rubygems.org',
      },
      () => this._getReleases(config),
    );
  }

  private getReleasesViaInfoEndpoint(
    registryUrl: string,
    packageName: string,
  ): AsyncResult<ReleaseResult, Error | ZodError> {
    const url = joinUrlParts(registryUrl, '/info', packageName);
    return Result.wrap(this.http.getText(url))
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
