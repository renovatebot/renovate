import { Marshal } from '@qnighy/marshal';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { getQueryString, joinUrlParts, parseUrl } from '../../../util/url';
import * as rubyVersioning from '../../versioning/ruby';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { RubygemsHttp } from './http';
import { MetadataCache } from './metadata-cache';
import { GemMetadata, GemVersions, MarshalledVersionInfo } from './schema';
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

    try {
      const { res: versionsResult } =
        await this.versionsEndpointCache.getVersions(registryUrl, packageName);

      if (versionsResult.success) {
        const { value: versions } = versionsResult;
        const result = await this.metadataCache.getRelease(
          registryUrl,
          packageName,
          versions
        );
        return result;
      }

      const registryHostname = parseUrl(registryUrl)?.hostname;
      if (
        versionsResult.error === 'unsupported-api' &&
        registryHostname !== 'rubygems.org'
      ) {
        if (
          registryHostname === 'rubygems.pkg.github.com' ||
          registryHostname === 'gitlab.com'
        ) {
          return await this.getReleasesViaFallbackAPI(registryUrl, packageName);
        }

        const gemMetadata = await this.fetchGemMetadata(
          registryUrl,
          packageName
        );
        if (!gemMetadata) {
          return await this.getReleasesViaFallbackAPI(registryUrl, packageName);
        }

        return await this.getReleasesViaAPI(
          registryUrl,
          packageName,
          gemMetadata
        );
      }

      return null;
    } catch (error) {
      this.handleGenericErrors(error);
    }
  }

  @cache({
    namespace: `datasource-${RubyGemsDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#7154)
      /* eslint-disable @typescript-eslint/restrict-template-expressions */
      `metadata:${registryUrl}/${packageName}`,
  })
  async fetchGemMetadata(
    registryUrl: string,
    packageName: string
  ): Promise<GemMetadata | null> {
    try {
      const { body } = await this.http.getJson(
        joinUrlParts(registryUrl, '/api/v1/gems', `${packageName}.json`),
        GemMetadata
      );
      return body;
    } catch (err) {
      // fallback to deps api on 404
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  @cache({
    namespace: `datasource-${RubyGemsDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#7154)
      /* eslint-disable @typescript-eslint/restrict-template-expressions */
      `versions:${registryUrl}/${packageName}`,
  })
  async fetchGemVersions(
    registryUrl: string,
    packageName: string
  ): Promise<GemVersions | null> {
    try {
      const { body } = await this.http.getJson(
        joinUrlParts(registryUrl, '/api/v1/versions', `${packageName}.json`),
        GemVersions
      );
      return body;
    } catch (err) {
      if (err.statusCode === 400 || err.statusCode === 404) {
        logger.debug(
          { registry: registryUrl },
          'versions endpoint returns error - falling back to info endpoint'
        );
        return null;
      } else {
        throw err;
      }
    }
  }

  async getReleasesViaAPI(
    registryUrl: string,
    packageName: string,
    gemMetadata: GemMetadata
  ): Promise<ReleaseResult | null> {
    const gemVersions = await this.fetchGemVersions(registryUrl, packageName);

    let releases: Release[] | null = null;
    if (gemVersions?.length) {
      releases = gemVersions;
    } else if (gemMetadata.latestVersion) {
      releases = [{ version: gemMetadata.latestVersion }];
    } else {
      return null;
    }

    const result: ReleaseResult = { releases };

    if (gemMetadata.changelogUrl) {
      result.changelogUrl = gemMetadata.changelogUrl;
    }

    if (gemMetadata.homepage) {
      result.homepage = gemMetadata.homepage;
    }

    if (gemMetadata.sourceUrl) {
      result.sourceUrl = gemMetadata.sourceUrl;
    }

    return result;
  }

  @cache({
    namespace: `datasource-${RubyGemsDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#7154)
      /* eslint-disable @typescript-eslint/restrict-template-expressions */
      `dependencies:${registryUrl}/${packageName}`,
  })
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
