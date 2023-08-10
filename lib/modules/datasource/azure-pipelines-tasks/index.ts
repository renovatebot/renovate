import { cache } from '../../../util/cache/package/decorator';
import { id as versioning } from '../../versioning/loose';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

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
    const versions =
      (await this.getTasks(BUILT_IN_TASKS_URL))[packageName.toLowerCase()] ??
      (await this.getTasks(MARKETPLACE_TASKS_URL))[packageName.toLowerCase()];

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
  async getTasks(url: string): Promise<Record<string, string[]>> {
    const { body } = await this.http.getJson<Record<string, string[]>>(url);
    return body;
  }
}
