import { GlobalConfig } from '../../../config/global';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpOptions } from '../../../util/http/types';
import { id as versioning } from '../../versioning/loose';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

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
    const endpoint = GlobalConfig.get('endpoint');
    const auth = Buffer.from(`renovate:${process.env.RENOVATE_TOKEN}`).toString(
      'base64',
    );
    const opts: HttpOptions = {
      headers: { authorization: `Basic ${auth}` },
    };
    const versions = (
      await this.getTasks(`${endpoint}/_apis/distributedtask/tasks/`, opts)
    )[packageName.toLowerCase()];

    if (versions) {
      const releases = versions.map((version) => ({ version }));
      return { releases };
    }

    return null;
  }

  @cache({
    namespace: `datasource-${AzurePipelinesTasksDatasource.id}`,
    key: (url: string) => url,
    ttlMinutes: 24 * 60,
  })
  async getTasks(
    url: string,
    opts: HttpOptions,
  ): Promise<Record<string, string[]>> {
    const { body } = await this.http.getJson<Record<string, string[]>>(
      url,
      opts,
    );
    return body;
  }
}
