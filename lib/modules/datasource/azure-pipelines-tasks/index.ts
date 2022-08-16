import dataFiles from '../../../data-files.generated';
import { id as versioning } from '../../versioning/loose';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

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

  getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const versions = this.builtInTasks[packageName.toLowerCase()];
    if (versions) {
      const releases = versions.map((version) => ({ version }));
      return Promise.resolve({ releases });
    }

    return Promise.resolve(null);
  }
}
