import { type ZodType } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import type { NonEmptyArray } from '../../../types/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { clone } from '../../../util/clone.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { RegistryDatasource } from '../datasource.ts';
import type {
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import {
  JenkinsPluginsInfoResponse,
  JenkinsPluginsVersionsResponse,
} from './schema.ts';

export class JenkinsPluginsDatasource extends RegistryDatasource {
  static readonly id = 'jenkins-plugins';

  constructor() {
    super(JenkinsPluginsDatasource.id);
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return true;
  }

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return ['https://updates.jenkins.io'];
  }

  override readonly registryStrategy = 'hunt';

  private static readonly packageInfoPath = 'current/update-center.actual.json';
  private static readonly packageVersionsPath = 'current/plugin-versions.json';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The releaseTimestamp is determined from the `releaseTimestamp` or `buildDate` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `scm` field in the results.';

  async getReleases({
    packageName,
    registryUrl,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const updateSiteUrl = ensureTrailingSlash(registryUrl);

    const plugins = await this.getJenkinsPluginInfo(updateSiteUrl);
    const plugin = plugins[packageName];
    if (!plugin) {
      return null;
    }

    const result = clone(plugin);
    const versions = await this.getJenkinsPluginVersions(updateSiteUrl);
    const releases = versions[packageName];
    result.releases = releases ? clone(releases) : [];
    return result;
  }

  private async _getJenkinsPluginInfo(
    updateSiteUrl: string,
  ): Promise<Record<string, ReleaseResult>> {
    const { plugins } = await this.getJenkinsUpdateCenterResponse(
      `${updateSiteUrl}${JenkinsPluginsDatasource.packageInfoPath}`,
      JenkinsPluginsInfoResponse,
    );

    const info: Record<string, ReleaseResult> = {};
    for (const name of Object.keys(plugins)) {
      info[name] = {
        releases: [], // releases
        sourceUrl: plugins[name]?.scm,
      };
    }
    return info;
  }

  getJenkinsPluginInfo(
    updateSiteUrl: string,
  ): Promise<Record<string, ReleaseResult>> {
    return withCache(
      {
        namespace: `datasource-${JenkinsPluginsDatasource.id}`,
        key: 'info',
        ttlMinutes: 1440,
      },
      () => this._getJenkinsPluginInfo(updateSiteUrl),
    );
  }

  private async _getJenkinsPluginVersions(
    updateSiteUrl: string,
  ): Promise<Record<string, Release[]>> {
    const { plugins } = await this.getJenkinsUpdateCenterResponse(
      `${updateSiteUrl}${JenkinsPluginsDatasource.packageVersionsPath}`,
      JenkinsPluginsVersionsResponse,
    );

    const versions: Record<string, Release[]> = {};
    for (const name of Object.keys(plugins)) {
      versions[name] = Object.keys(plugins[name]).map((version) => {
        const downloadUrl = plugins[name][version]?.url;
        const buildDate = plugins[name][version]?.buildDate;
        const releaseTimestamp =
          plugins[name][version]?.releaseTimestamp ?? asTimestamp(buildDate);
        const jenkins = plugins[name][version]?.requiredCore;
        const constraints = jenkins ? { jenkins: [`>=${jenkins}`] } : undefined;
        return {
          version,
          downloadUrl,
          releaseTimestamp,
          ...(constraints && { constraints }),
        };
      });
    }
    return versions;
  }

  getJenkinsPluginVersions(
    updateSiteUrl: string,
  ): Promise<Record<string, Release[]>> {
    return withCache(
      {
        namespace: `datasource-${JenkinsPluginsDatasource.id}`,
        key: 'versions',
      },
      () => this._getJenkinsPluginVersions(updateSiteUrl),
    );
  }

  private async getJenkinsUpdateCenterResponse<T>(
    url: string,
    schema: ZodType<T>,
  ): Promise<T> {
    let response: T;

    try {
      logger.debug(`jenkins-plugins: Fetching Jenkins plugins from ${url}`);
      const startTime = Date.now();
      response = (await this.http.getJson(url, schema)).body;
      const durationMs = Math.round(Date.now() - startTime);
      logger.debug(
        { durationMs },
        `jenkins-plugins: Fetched Jenkins plugins from ${url}`,
      );
    } catch (err) /* istanbul ignore next */ {
      this.handleGenericErrors(err);
    }

    return response;
  }
}
