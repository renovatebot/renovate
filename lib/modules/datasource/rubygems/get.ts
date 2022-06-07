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
  JsonNexusGemsItems,
  MarshalledVersionInfo,
  NexusGems,
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
    const { endPoint, repository } = this.nexusEndPointRepoFrom(registry);
    if (
      is.nonEmptyString(endPoint) &&
      is.nonEmptyString(repository) &&
      (await this.isNexusDataSource(endPoint))
    ) {
      logger.debug(
        { dependency, api: 'Nexus' },
        'RubyGems lookup for dependency'
      );
      const gemReleases: Release[] = await this.getReleasesFromNexus(
        repository,
        endPoint,
        dependency
      );
      return {
        releases: gemReleases,
      };
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

  private nexusEndPointRepoFrom(registry: string): {
    endPoint: string;
    repository: string;
  } {
    const endPointRe = regEx(
      `^(?<endPoint>.*:\\d{1,5}).*\\/repository\\/(?<repository>\\w+)\\/?`
    );
    const { endPoint, repository } = registry.match(endPointRe)?.groups ?? {
      endPoint: '',
      repository: '',
    };
    return { endPoint, repository };
  }

  @cache({
    namespace: 'datasource-nexus',
    key: (nexusEndPoint: string) => `isNexusDataSource:${nexusEndPoint}`,
  })
  async isNexusDataSource(nexusEndPoint: string): Promise<boolean> {
    const statusEndPoint = '/service/rest/v1/status';
    const nexusUrl = nexusEndPoint.concat(statusEndPoint);
    let isNexus = false;
    try {
      const response = await this.http.getJson<HttpResponse>(nexusUrl);
      isNexus = response.headers?.server?.includes('Nexus') ?? false;
    } catch (err) {
      return false;
    }
    return isNexus;
  }

  private async getReleasesFromNexus(
    repository: string,
    endPoint: string,
    dependencyName: string
  ): Promise<Release[]> {
    const result: Release[] = [];
    const gemItems: JsonNexusGemsItems[] = [];
    const url = this.getNexusGemReleasesEndPoint(
      repository,
      endPoint,
      dependencyName
    );
    try {
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
    } catch (error) {
      logger.debug({ error }, 'Failed to retreive gems from nexus');
      throw error;
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
    endPoint: string,
    depName: string
  ): string {
    const nexusSearchPoint = '/service/rest/v1/search';
    const query = `${nexusSearchPoint}?repository=${repository}&name=${depName}&sort=version`;
    const gemReleasesEndPoint = endPoint.concat(query);
    return gemReleasesEndPoint;
  }

  private async paginationResult(
    url: string,
    continuationToken: string
  ): Promise<JsonNexusGemsItems[]> {
    const gemItems: JsonNexusGemsItems[] = [];
    let pageToken: string | null = continuationToken;
    while (pageToken) {
      const gemsOfPage: NexusGems = await this.pageOfNexusGems(url, pageToken);
      gemItems.push(...gemsOfPage.items.filter(Boolean));
      pageToken = gemsOfPage.continuationToken;
    }
    return gemItems;
  }

  private async pageOfNexusGems(
    url: string,
    pageToken: string
  ): Promise<NexusGems> {
    let nexusPage: NexusGems = { continuationToken: null, items: [] };
    try {
      const paginateUrl = url.concat(`&continuationToken=${pageToken}`);
      const response = await this.http.getJson<NexusGems>(paginateUrl);
      nexusPage = response.body;
    } catch (error) {
      logger.debug({ error }, 'Failed to retreive gems page from nexus');
      throw error;
    }
    return nexusPage;
  }
}
