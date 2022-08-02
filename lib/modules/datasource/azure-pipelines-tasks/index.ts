import { id as versioning } from '../../versioning/loose';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { BuiltInAzurePipelinesTaskMajorVersions } from './built-in';

export class AzurePipelinesTasksDatasource extends Datasource {
  static readonly id = 'azure-pipelines-tasks';

  constructor() {
    super(AzurePipelinesTasksDatasource.id);
  }

  override readonly caching = true;

  override readonly customRegistrySupport = false;

  override readonly defaultVersioning = versioning;

  getReleases({
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (BuiltInAzurePipelinesTaskMajorVersions.has(packageName.toLowerCase())) {
      const versions = BuiltInAzurePipelinesTaskMajorVersions.get(
        packageName.toLowerCase()
      );
      if (versions) {
        const releases = versions.map((version) => ({ version }));
        return Promise.resolve({ releases });
      }
    }

    return Promise.resolve(null);
  }
}
