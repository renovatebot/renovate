import type { TypeOf, ZodType } from 'zod';
import { GlobalConfig } from '../../../config/global';
import { cache } from '../../../util/cache/package/decorator';
import * as hostRules from '../../../util/host-rules';
import type { HttpOptions } from '../../../util/http/types';
import { id as versioning } from '../../versioning/loose';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import {
  AzurePipelinesFallbackTasks,
  AzurePipelinesJSON,
  AzurePipelinesTaskVersion,
} from './schema';

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
    const { token } = hostRules.find({
      hostType: AzurePipelinesTasksDatasource.id,
      url: endpoint,
    });

    if (platform === 'azure' && endpoint && token) {
      const auth = Buffer.from(`renovate:${token}`).toString('base64');
      const opts: HttpOptions = {
        headers: { authorization: `Basic ${auth}` },
      };
      const results = await this.getTasks(
        `${endpoint}/_apis/distributedtask/tasks/`,
        opts,
        AzurePipelinesJSON,
      );

      const result: ReleaseResult = { releases: [] };

      results.value
        .filter((task) => task.name === packageName)
        .sort(AzurePipelinesTasksDatasource.compareSemanticVersions('version'))
        .forEach((task) => {
          result.releases.push({
            version: `${task.version!.major}.${task.version!.minor}.${task.version!.patch}`,
            isDeprecated: task.deprecated,
          });
        });

      return result;
    } else {
      const versions =
        (
          await this.getTasks(
            BUILT_IN_TASKS_URL,
            {},
            AzurePipelinesFallbackTasks,
          )
        )[packageName.toLowerCase()] ??
        (
          await this.getTasks(
            MARKETPLACE_TASKS_URL,
            {},
            AzurePipelinesFallbackTasks,
          )
        )[packageName.toLowerCase()];

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
  async getTasks<Schema extends ZodType>(
    url: string,
    opts: HttpOptions,
    schema: Schema,
  ): Promise<TypeOf<Schema>> {
    const { body } = await this.http.getJson(url, opts, schema);
    return body;
  }

  static compareSemanticVersions = (key: string) => (a: any, b: any) => {
    const a1Version = AzurePipelinesTaskVersion.safeParse(a[key]).data;
    const b1Version = AzurePipelinesTaskVersion.safeParse(b[key]).data;

    const a1 =
      a1Version === undefined
        ? ''
        : `${a1Version.major}.${a1Version.minor}.${a1Version.patch}`;
    const b1 =
      b1Version === undefined
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
