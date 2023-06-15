import { Marshal } from '@qnighy/marshal';
import { PAGE_NOT_FOUND_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { getQueryString, joinUrlParts, parseUrl } from '../../../util/url';
import * as rubyVersioning from '../../versioning/ruby';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { GemVersions, GemsInfo, MarshalledVersionInfo } from './schema';
import { VersionsDatasource } from './versions-datasource';

export class RubyGemsDatasource extends Datasource {
  static readonly id = 'rubygems';

  constructor() {
    super(RubyGemsDatasource.id);
    this.versionsDatasource = new VersionsDatasource(RubyGemsDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://rubygems.org'];

  override readonly defaultVersioning = rubyVersioning.id;

  override readonly registryStrategy = 'hunt';

  private readonly versionsDatasource: VersionsDatasource;

  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    try {
      return await this.versionsDatasource.getReleases({
        packageName,
        registryUrl,
      });
    } catch (error) {
      if (
        error.message === PAGE_NOT_FOUND_ERROR &&
        parseUrl(registryUrl)?.hostname !== 'rubygems.org'
      ) {
        const hostname = parseUrl(registryUrl)?.hostname;
        return hostname === 'rubygems.pkg.github.com' ||
          hostname === 'gitlab.com'
          ? await this.getDependencyFallback(registryUrl, packageName)
          : await this.getDependency(registryUrl, packageName);
      }
      throw error;
    }
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

  @cache({
    namespace: `datasource-${RubyGemsDatasource.id}-getDependency`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#7154)
      /* eslint-disable @typescript-eslint/restrict-template-expressions */
      `${registryUrl}/${packageName}`,
  })
  async getDependency(
    registryUrl: string,
    packageName: string
  ): Promise<ReleaseResult | null> {
    const info = await this.fetchGemsInfo(registryUrl, packageName);
    if (!info) {
      return await this.getDependencyFallback(registryUrl, packageName);
    }

    if (info.packageName !== packageName) {
      logger.warn(
        { lookup: packageName, returned: info.packageName },
        'Lookup name does not match the returned name.'
      );
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
