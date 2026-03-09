import { withCache } from '../../../util/cache/package/with-cache.ts';
import * as azureRestApiVersioningApi from '../../versioning/azure-rest-api/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { BicepResourceVersionIndex } from './schema.ts';

const BICEP_TYPES_INDEX_URL =
  'https://raw.githubusercontent.com/Azure/bicep-types-az/main/generated/index.json';

export class AzureBicepResourceDatasource extends Datasource {
  static readonly id = 'azure-bicep-resource';

  override readonly defaultConfig = {
    commitMessageTopic: 'resource {{depName}}',
    commitMessageExtra: 'to {{{newVersion}}}',
    prBodyColumns: ['Resource', 'Change'],
    prBodyDefinitions: {
      Resource: '{{{depNameLinked}}}',
    },
  };

  override readonly defaultVersioning = azureRestApiVersioningApi.id;

  constructor() {
    super(AzureBicepResourceDatasource.id);
  }

  private getChangelogUrl(packageName: string): string {
    const firstSlashIndex = packageName.indexOf('/');
    const namespaceProvider = packageName.slice(0, firstSlashIndex);
    const type = packageName.slice(firstSlashIndex + 1);
    return `https://learn.microsoft.com/en-us/azure/templates/${namespaceProvider}/change-log/${type}`;
  }

  private async _getReleases(
    getReleasesConfig: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const resourceVersionIndex = await this.getResourceVersionIndex();
    const packageName = getReleasesConfig.packageName.toLowerCase();
    const versions = resourceVersionIndex[packageName];
    if (!versions?.length) {
      return null;
    }

    const changelogUrl = this.getChangelogUrl(packageName);
    const releases = versions.map((version) => ({
      version,
      changelogUrl: `${changelogUrl}#${version}`,
    }));
    return { releases };
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${AzureBicepResourceDatasource.id}`,
        key: `getReleases-${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private async _getResourceVersionIndex(): Promise<BicepResourceVersionIndex> {
    const { body } = await this.http.getJson(
      BICEP_TYPES_INDEX_URL,
      BicepResourceVersionIndex,
    );
    return body;
  }

  getResourceVersionIndex(): Promise<BicepResourceVersionIndex> {
    return withCache(
      {
        namespace: `datasource-${AzureBicepResourceDatasource.id}`,
        key: 'getResourceVersionIndex',
        ttlMinutes: 24 * 60,
      },
      () => this._getResourceVersionIndex(),
    );
  }
}
