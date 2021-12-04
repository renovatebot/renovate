import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { clone } from '../../util/clone';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type {
  JenkinsPluginsInfoResponse,
  JenkinsPluginsVersionsResponse,
} from './types';

export class JenkinsPluginsDatasource extends Datasource {
  static readonly id = 'jenkins-plugins';

  constructor() {
    super(JenkinsPluginsDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://updates.jenkins.io'];

  override readonly registryStrategy = 'hunt';

  private static readonly packageInfoUrl =
    'https://updates.jenkins.io/current/update-center.actual.json';
  private static readonly packageVersionsUrl =
    'https://updates.jenkins.io/current/plugin-versions.json';

  async getReleases({
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const plugins = await this.getJenkinsPluginInfo();
    const plugin = plugins[lookupName];
    if (!plugin) {
      return null;
    }

    const result = clone(plugin);
    const versions = await this.getJenkinsPluginVersions();
    const releases = versions[lookupName];
    result.releases = releases ? clone(releases) : [];
    return result;
  }

  @cache({
    namespace: JenkinsPluginsDatasource.id,
    key: 'info',
    ttlMinutes: 1440,
  })
  async getJenkinsPluginInfo(): Promise<Record<string, ReleaseResult>> {
    const { plugins } =
      await this.getJenkinsUpdateCenterResponse<JenkinsPluginsInfoResponse>(
        JenkinsPluginsDatasource.packageInfoUrl
      );

    const info: Record<string, ReleaseResult> = {};
    for (const name of Object.keys(plugins ?? [])) {
      info[name] = {
        releases: [], // releases
        sourceUrl: plugins[name]?.scm,
      };
    }
    return info;
  }

  @cache({ namespace: JenkinsPluginsDatasource.id, key: 'versions' })
  async getJenkinsPluginVersions(): Promise<Record<string, Release[]>> {
    const { plugins } =
      await this.getJenkinsUpdateCenterResponse<JenkinsPluginsVersionsResponse>(
        JenkinsPluginsDatasource.packageVersionsUrl
      );

    const versions: Record<string, Release[]> = {};
    for (const name of Object.keys(plugins ?? [])) {
      versions[name] = Object.keys(plugins[name]).map((version) => ({
        version,
        downloadUrl: plugins[name][version]?.url,
        releaseTimestamp: plugins[name][version]?.buildDate
          ? new Date(`${plugins[name][version].buildDate} UTC`)
          : null,
      }));
    }
    return versions;
  }

  private async getJenkinsUpdateCenterResponse<T>(url: string): Promise<T> {
    let response: T;

    try {
      logger.debug(`jenkins-plugins: Fetching Jenkins plugins from ${url}`);
      const startTime = Date.now();
      response = (await this.http.getJson<T>(url)).body;
      const durationMs = Math.round(Date.now() - startTime);
      logger.debug(
        { durationMs },
        `jenkins-plugins: Fetched Jenkins plugins from ${url}`
      );
    } catch (err) /* istanbul ignore next */ {
      this.handleGenericErrors(err);
    }

    return response;
  }
}
