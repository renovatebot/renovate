import { cache } from '../../../util/cache/package/decorator';
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

  getChangelogUrl(packageName: string): string {
    const firstSlashIndex = packageName.indexOf('/');
    const namespaceProvider = packageName
      .slice(0, firstSlashIndex)
      .toLowerCase();
    const type = packageName.slice(firstSlashIndex + 1).toLowerCase();
    return `https://learn.microsoft.com/en-us/azure/templates/${namespaceProvider}/change-log/${type}`;
  }

  @cache({
    namespace: `datasource-${AzureBicepResourceDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `getReleases-${packageName}`,
  })
  async getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult | null> {
    const { packageName } = getReleasesConfig;

    const resourceVersionIndex = await this.getResourceVersionIndex();

    const versions = resourceVersionIndex[packageName.toLowerCase()];
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

  @cache({
    namespace: `datasource-${AzureBicepResourceDatasource.id}`,
    key: 'getResourceVersionIndex',
    ttlMinutes: 24 * 60,
  })
  async getResourceVersionIndex(): Promise<BicepResourceVersionIndex> {
    const { body: resourceVersionIndex } = await this.http.getJson(
      BICEP_TYPES_INDEX_URL,
      BicepResourceVersionIndex
    );
    return resourceVersionIndex;
  }
}
