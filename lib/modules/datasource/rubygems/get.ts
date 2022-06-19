import is from '@sindresorhus/is';
import Marshal from 'marshal';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import type { HttpResponse } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { getQueryString, joinUrlParts, parseUrl } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type {
  JsonGemVersions,
  JsonGemsInfo,
  MarshalledVersionInfo,
  NexusGems,
  NexusGemsItems,
} from './types';

const INFO_PATH = '/api/v1/gems';
const VERSIONS_PATH = '/api/v1/versions';
const DEPENDENCIES_PATH = '/api/v1/dependencies';

export class InternalRubyGemsDatasource extends Datasource {
  constructor(override readonly id: string) {
    super(id);
  }

  private knownFallbackHosts = ['rubygems.pkg.github.com', 'gitlab.com'];

  override getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return Promise.resolve(null);
    }
    const hostname = parseUrl(registryUrl)?.hostname;
    if (hostname && this.knownFallbackHosts.includes(hostname)) {
      return this.getDependencyFallback(packageName, registryUrl);
    }
    return this.getDependency(packageName, registryUrl);
  }

  async getDependencyFallback(
    dependency: string,
    registry: string
  ): Promise<ReleaseResult | null> {
    const { nexusRegistry, repository } = this.nexusEndPointRepoFrom(registry);
    if (
      nexusRegistry &&
      repository &&
      (await this.isNexusDataSource(nexusRegistry))
    ) {
      logger.debug(
        { dependency, api: 'Nexus' },
        'RubyGems lookup for dependency'
      );
      try {
        const gemReleases = await this.getReleasesFromNexus(
          repository,
          nexusRegistry,
          dependency
        );
        return {
          releases: gemReleases,
        };
      } catch (err) {
        logger.debug(
          { errorMsg: err?.message, errorCode: err?.statusCode },
          'Failed to retrieve gem from nexus source'
        );
        return {
          releases: [],
        };
      }
    }

    logger.debug(
      { dependency, api: DEPENDENCIES_PATH },
      'RubyGems lookup for dependency'
    );
    const info = await this.fetchBuffer<MarshalledVersionInfo[]>(
      dependency,
      registry,
      DEPENDENCIES_PATH
    );
    if (!info || info.length === 0) {
      return null;
    }
    const releases = info.map(
      ({ number: version, platform: rubyPlatform }) => ({
        version,
        rubyPlatform,
      })
    );
    return {
      releases,
      sourceUrl: null,
    };
  }

  async getDependency(
    dependency: string,
    registry: string
  ): Promise<ReleaseResult | null> {
    logger.debug(
      { dependency, api: INFO_PATH },
      'RubyGems lookup for dependency'
    );
    let info: JsonGemsInfo;

    try {
      info = await this.fetchJson(dependency, registry, INFO_PATH);
    } catch (error) {
      // fallback to deps api on 404
      if (error instanceof HttpError && error.response?.statusCode === 404) {
        return await this.getDependencyFallback(dependency, registry);
      }
      throw error;
    }

    if (!info) {
      logger.debug({ dependency }, 'RubyGems package not found.');
      return null;
    }

    if (dependency.toLowerCase() !== info.name.toLowerCase()) {
      logger.warn(
        { lookup: dependency, returned: info.name },
        'Lookup name does not match with returned.'
      );
      return null;
    }

    let versions: JsonGemVersions[] = [];
    let releases: Release[] = [];
    try {
      versions = await this.fetchJson(dependency, registry, VERSIONS_PATH);
    } catch (err) {
      if (err.statusCode === 400 || err.statusCode === 404) {
        logger.debug(
          { registry },
          'versions endpoint returns error - falling back to info endpoint'
        );
      } else {
        throw err;
      }
    }

    // TODO: invalid properties for `Release` see #11312

    if (versions.length === 0 && info.version) {
      logger.warn('falling back to the version from the info endpoint');
      releases = [
        {
          version: info.version,
          rubyPlatform: info.platform,
        } as Release,
      ];
    } else {
      releases = versions.map(
        ({
          number: version,
          platform: rubyPlatform,
          created_at: releaseTimestamp,
          rubygems_version: rubygemsVersion,
          ruby_version: rubyVersion,
        }) => ({
          version,
          rubyPlatform,
          releaseTimestamp,
          rubygemsVersion,
          rubyVersion,
        })
      );
    }

    return {
      releases,
      homepage: info.homepage_uri,
      sourceUrl: info.source_code_uri,
      changelogUrl: info.changelog_uri,
    };
  }

  private async fetchJson<T>(
    dependency: string,
    registry: string,
    path: string
  ): Promise<T> {
    const url = joinUrlParts(registry, path, `${dependency}.json`);

    logger.trace({ registry, dependency, url }, `RubyGems lookup request`);
    const response = (await this.http.getJson<T>(url)) || {
      body: undefined,
    };

    return response.body;
  }

  private async fetchBuffer<T>(
    dependency: string,
    registry: string,
    path: string
  ): Promise<T | null> {
    const url = `${joinUrlParts(registry, path)}?${getQueryString({
      gems: dependency,
    })}`;

    logger.trace({ registry, dependency, url }, `RubyGems lookup request`);
    const response = await this.http.getBuffer(url);

    // istanbul ignore if: needs tests
    if (!response) {
      return null;
    }

    return new Marshal(response.body).parsed as T;
  }

  private nexusEndPointRepoFrom(url: string): {
    nexusRegistry?: string;
    repository?: string;
  } {
    const endPointRe = regEx(
      `^(?<nexusRegistry>.*:\\d{1,5}).*\\/repository\\/(?<repository>\\w+)\\/?`
    );
    const { nexusRegistry, repository } = url.match(endPointRe)?.groups ?? {};
    return { nexusRegistry, repository };
  }

  @cache({
    namespace: 'datasource-nexus',
    key: (nexusEndPoint: string) => `isNexusDataSource:${nexusEndPoint}`,
    ttlMinutes: 1440,
  })
  async isNexusDataSource(nexusEndPoint: string): Promise<boolean> {
    const statusEndPoint = '/service/rest/v1/status';
    const nexusUrl = nexusEndPoint.concat(statusEndPoint);
    try {
      const response = await this.http.getJson<HttpResponse>(nexusUrl);
      return this.extractServerFrom(response).startsWith('Nexus/') ?? false;
    } catch (err) {
      // istanbul ignore if
      if (err.response?.headers?.server?.startsWith('Nexus/')) {
        this.handleGenericErrors(err);
      }
      return false;
    }
  }

  private extractServerFrom(
    response: HttpResponse<HttpResponse<string>>
  ): string {
    let headerRespose = '';
    if (is.string(response.headers?.server)) {
      headerRespose = response.headers?.server;
    }
    // istanbul ignore else: not testable with nock
    else if (is.array(response.headers?.server)) {
      [headerRespose] = response.headers?.server ?? [''];
    }
    return headerRespose;
  }

  private async getReleasesFromNexus(
    repository: string,
    nexusRegistry: string,
    dependencyName: string
  ): Promise<Release[]> {
    const result: Release[] = [];
    const gemItems: NexusGemsItems[] = [];
    const url = this.getNexusGemReleasesEndPoint(
      repository,
      nexusRegistry,
      dependencyName
    );
    const nexusResponse = (await this.http.getJson<NexusGems>(url))?.body || {
      continuationToken: null,
      items: [],
    };
    gemItems.push(...nexusResponse.items);
    const continuationToken: string | null = nexusResponse.continuationToken;
    if (continuationToken) {
      const paginationGems = await this.paginationResult(
        url,
        continuationToken
      );
      gemItems.push(...paginationGems);
    }

    result.push(
      ...gemItems.map((item) => {
        return { version: item.version, rubyPlatform: 'nexus' };
      })
    );
    return result;
  }

  private getNexusGemReleasesEndPoint(
    repository: string,
    nexusRegistry: string,
    depName: string
  ): string {
    const nexusSearchPoint = '/service/rest/v1/search';
    const query = `${nexusSearchPoint}?repository=${repository}&name=${depName}&sort=version`;
    return joinUrlParts(nexusRegistry, query);
  }

  private async paginationResult(
    url: string,
    continuationToken: string
  ): Promise<NexusGemsItems[]> {
    const gemItems: NexusGemsItems[] = [];
    let pageToken: string | null = continuationToken;
    let pageCounter = 0;
    while (pageToken && pageCounter < 1000) {
      const paginateUrl = joinUrlParts(url, `&continuationToken=${pageToken}`);
      const response = await this.http.getJson<NexusGems>(paginateUrl);
      const gemsOfPage = response?.body;
      gemItems.push(...gemsOfPage.items.filter(Boolean));
      pageToken = gemsOfPage.continuationToken;
      pageCounter++;
    }
    return gemItems;
  }
}
