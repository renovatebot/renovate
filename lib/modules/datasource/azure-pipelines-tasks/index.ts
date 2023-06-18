import dataFiles from '../../../data-files.generated';
import { cache } from '../../../util/cache/package/decorator';
import { id as versioning } from '../../versioning/loose';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

const MARKETPLACE_TASKS_URL =
  'https://raw.githubusercontent.com/renovatebot/azure-devops-marketplace/main/azure-pipelines-marketplace-tasks.json';

export class AzurePipelinesTasksDatasource extends Datasource {
  static readonly id = 'azure-pipelines-tasks';

  private readonly builtInTasks: Record<string, string[]>;

  constructor() {
    super(AzurePipelinesTasksDatasource.id);
    this.builtInTasks = JSON.parse(
      dataFiles.get('data/azure-pipelines-tasks.json')!
    );
  }

  override readonly customRegistrySupport = false;

  override readonly defaultVersioning = versioning;

  async getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const versions =
      this.builtInTasks[packageName.toLowerCase()] ??
      (await this.getMarketplaceTasks())[packageName.toLowerCase()];

    if (versions) {
      const releases = versions.map((version) => ({ version }));
      return Promise.resolve({ releases });
    }

    return Promise.resolve(null);
  }

  @cache({
    namespace: `datasource-${AzurePipelinesTasksDatasource.id}`,
    key: 'azure-pipelines-marketplace-tasks',
    ttlMinutes: 24 * 60,
  })
  async getMarketplaceTasks(): Promise<Record<string, string[]>> {
    const { body } = await this.http.getJson<Record<string, string[]>>(
      MARKETPLACE_TASKS_URL
    );
    return body;
  }
}
