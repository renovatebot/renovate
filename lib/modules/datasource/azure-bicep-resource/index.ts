import { cached } from '../../../util/cache/package/cached';
import * as azureRestApiVersioningApi from '../../versioning/azure-rest-api';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { BicepResourceVersionIndex } from './schema';

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
    return cached(
      {
        namespace: `datasource-${AzureBicepResourceDatasource.id}`,
        key: `getReleases-${config.packageName}`,
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
    return cached(
      {
        namespace: `datasource-${AzureBicepResourceDatasource.id}`,
        key: 'getResourceVersionIndex',
        ttlMinutes: 24 * 60,
      },
      () => this._getResourceVersionIndex(),
    );
  }
}
