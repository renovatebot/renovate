import { Marshal } from '@qnighy/marshal';
import { HttpError } from '../../../util/http';
import { Result } from '../../../util/result';
import { getQueryString, joinUrlParts, parseUrl } from '../../../util/url';
import * as rubyVersioning from '../../versioning/ruby';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { getV1Releases } from './common';
import { RubygemsHttp } from './http';
import { MetadataCache } from './metadata-cache';
import { MarshalledVersionInfo } from './schema';
import { VersionsEndpointCache } from './versions-endpoint-cache';

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

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const { val: rubygemsResult, err: rubygemsError } = await Result.wrap(
      this.versionsEndpointCache.getVersions(registryUrl, packageName)
    )
      .transform((versions) =>
        this.metadataCache.getRelease(registryUrl, packageName, versions)
      )
      .unwrap();

    // istanbul ignore else: will be removed soon
    if (rubygemsResult) {
      return rubygemsResult;
    } else if (rubygemsError instanceof Error) {
      this.handleGenericErrors(rubygemsError);
    }

    try {
      const registryHostname = parseUrl(registryUrl)?.hostname;

      if (
        rubygemsError === 'unsupported-api' &&
        registryHostname !== 'rubygems.org'
      ) {
        if (
          registryHostname === 'rubygems.pkg.github.com' ||
          registryHostname === 'gitlab.com'
        ) {
          return await this.getReleasesViaFallbackAPI(registryUrl, packageName);
        }

        const { val: apiV1Result, err: apiV1Error } = await getV1Releases(
          this.http,
          registryUrl,
          packageName
        ).unwrap();
        if (apiV1Result) {
          return apiV1Result;
        } else if (apiV1Error instanceof HttpError) {
          throw apiV1Error;
        }

        return await this.getReleasesViaFallbackAPI(registryUrl, packageName);
      }

      return null;
    } catch (error) {
      this.handleGenericErrors(error);
    }
  }

  async getReleasesViaFallbackAPI(
    registryUrl: string,
    packageName: string
  ): Promise<ReleaseResult | null> {
    const path = joinUrlParts(registryUrl, `/api/v1/dependencies`);
    const query = getQueryString({ gems: packageName });
    const url = `${path}?${query}`;
    const { body: buffer } = await this.http.getBuffer(url);
    const data = Marshal.parse(buffer);
    return MarshalledVersionInfo.parse(data);
  }
}
