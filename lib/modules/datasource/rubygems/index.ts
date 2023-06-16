import { Marshal } from '@qnighy/marshal';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { getQueryString, joinUrlParts, parseUrl } from '../../../util/url';
import * as rubyVersioning from '../../versioning/ruby';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { GemVersions, GemsInfo, MarshalledVersionInfo } from './schema';
import { VersionsEndpointCache } from './versions-endpoint-cache';

export class RubyGemsDatasource extends Datasource {
  static readonly id = 'rubygems';

  constructor() {
    super(RubyGemsDatasource.id);
    this.versionsEndpointCache = new VersionsEndpointCache(this.http);
  }

  override readonly defaultRegistryUrls = ['https://rubygems.org'];

  override readonly defaultVersioning = rubyVersioning.id;

  override readonly registryStrategy = 'hunt';

  private readonly versionsEndpointCache: VersionsEndpointCache;

  @cache({
    namespace: `datasource-${RubyGemsDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#7154)
      /* eslint-disable @typescript-eslint/restrict-template-expressions */
      `${registryUrl}/${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    try {
      const cachedVersions = await this.versionsEndpointCache.getVersions(
        registryUrl,
        packageName
      );

      if (cachedVersions.type === 'success') {
        const { versions } = cachedVersions;
        return { releases: versions.map((version) => ({ version })) };
      }

      const registryHostname = parseUrl(registryUrl)?.hostname;
      if (
        cachedVersions.type === 'not-supported' &&
        registryHostname !== 'rubygems.org'
      ) {
        if (
          registryHostname === 'rubygems.pkg.github.com' ||
          registryHostname === 'gitlab.com'
        ) {
          return await this.getDependencyFallback(registryUrl, packageName);
        }

        const result = await this.getDependency(registryUrl, packageName);
        if (result) {
          return result;
        }

        return await this.getDependencyFallback(registryUrl, packageName);
      }
    } catch (error) {
      this.handleGenericErrors(error);
    }

    return null;
  }

  async getDependencyFallback(
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

  async fetchGemsInfo(
    registryUrl: string,
    packageName: string
  ): Promise<GemsInfo | null> {
    try {
      const { body } = await this.http.getJson(
        joinUrlParts(registryUrl, '/api/v1/gems', `${packageName}.json`),
        GemsInfo
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

  async getDependency(
    registryUrl: string,
    packageName: string
  ): Promise<ReleaseResult | null> {
    const info = await this.fetchGemsInfo(registryUrl, packageName);
    if (!info) {
      return null;
    }

    let releases: Release[] | null = null;
    const gemVersions = await this.fetchGemVersions(registryUrl, packageName);
    if (gemVersions?.length) {
      releases = gemVersions;
    } else if (info.version) {
      releases = [{ version: info.version }];
    }

    if (!releases) {
      return null;
    }

    const result: ReleaseResult = { releases };

    if (info.changelogUrl) {
      result.changelogUrl = info.changelogUrl;
    }

    if (info.homepage) {
      result.homepage = info.homepage;
    }

    if (info.sourceUrl) {
      result.sourceUrl = info.sourceUrl;
    }

    return result;
  }
}
