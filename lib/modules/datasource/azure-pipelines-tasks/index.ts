import { GlobalConfig } from '../../../config/global';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpOptions } from '../../../util/http/types';
import { id as versioning } from '../../versioning/loose';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { AzurePipelinesJSON, AzurePipelinesTaskVersion } from './types';

const TASKS_URL_BASE =
  'https://raw.githubusercontent.com/renovatebot/azure-devops-marketplace/main';
const BUILT_IN_TASKS_URL = `${TASKS_URL_BASE}/azure-pipelines-builtin-tasks.json`;
const MARKETPLACE_TASKS_URL = `${TASKS_URL_BASE}/azure-pipelines-marketplace-tasks.json`;

export class AzurePipelinesTasksDatasource extends Datasource {
  static readonly id = 'azure-pipelines-tasks';

  constructor() {
    super(AzurePipelinesTasksDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultVersioning = versioning;

  async getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const platform = GlobalConfig.get('platform');
    const endpoint = GlobalConfig.get('endpoint');

    if (platform === 'azure' && endpoint) {
      const auth = Buffer.from(
        `renovate:${process.env.RENOVATE_TOKEN}`,
      ).toString('base64');
      const opts: HttpOptions = {
        headers: { authorization: `Basic ${auth}` },
      };
      const results = await this.getTasks<AzurePipelinesJSON>(
        `${endpoint}/_apis/distributedtask/tasks/`,
        opts,
      );

      if (results.value) {
        const result: ReleaseResult = { releases: [] };

        results.value
          .filter((task) => task.name === packageName)
          .sort(
            AzurePipelinesTasksDatasource.compareSemanticVersions('version'),
          )
          .forEach((task) => {
            result.releases.push({
              version: `${task.version.major}.${task.version.minor}.${task.version.patch}`,
              isDeprecated: task.deprecated,
            });
          });

        return result;
      }
    } else {
      const versions =
        (await this.getTasks<Record<string, string[]>>(BUILT_IN_TASKS_URL))[
          packageName.toLowerCase()
        ] ??
        (await this.getTasks<Record<string, string[]>>(MARKETPLACE_TASKS_URL))[
          packageName.toLowerCase()
        ];

      if (versions) {
        const releases = versions.map((version) => ({ version }));
        return { releases };
      }
    }

    return null;
  }

  @cache({
    namespace: `datasource-${AzurePipelinesTasksDatasource.id}`,
    key: (url: string) => url,
    ttlMinutes: 24 * 60,
  })
  async getTasks<ResT>(url: string, opts?: HttpOptions): Promise<ResT> {
    const { body } = await this.http.getJson<ResT>(url, opts);
    return body;
  }

  static compareSemanticVersions = (key: string) => (a: any, b: any) => {
    const a1Version = a[key] as AzurePipelinesTaskVersion;
    const b1Version = b[key] as AzurePipelinesTaskVersion;

    const a1 =
      a1Version === null
        ? ''
        : `${a1Version.major}.${a1Version.minor}.${a1Version.patch}`;
    const b1 =
      b1Version === null
        ? ''
        : `${b1Version.major}.${b1Version.minor}.${b1Version.patch}`;

    const len = Math.min(a1.length, b1.length);

    for (let i = 0; i < len; i++) {
      const a2 = +a1[i] || 0;
      const b2 = +b1[i] || 0;

      if (a2 !== b2) {
        return a2 > b2 ? 1 : -1;
      }
    }

    return b1.length - a1.length;
  };
}
