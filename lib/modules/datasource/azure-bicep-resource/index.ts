import { cache } from '../../../util/cache/package/decorator';
import * as azureRestApiVersioningApi from '../../versioning/azure-rest-api';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { BicepResourceVersionIndex } from './schema';

const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com';
const BICEP_TYPES_INDEX_PATH = 'Azure/bicep-types-az/main/generated/index.json';

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

  override readonly defaultRegistryUrls = [DEFAULT_REGISTRY_URL];

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

  @cache({
    namespace: `datasource-${AzureBicepResourceDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `getReleases-${packageName}`,
  })
  async getReleases(
    getReleasesConfig: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    if (!getReleasesConfig.registryUrl) {
      return null;
    }

    const resourceVersionIndex =
      await this.getResourceVersionIndex(getReleasesConfig.registryUrl);
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

  @cache({
    namespace: `datasource-${AzureBicepResourceDatasource.id}`,
    key: 'getResourceVersionIndex',
    ttlMinutes: 24 * 60,
  })
  async getResourceVersionIndex(
    registryUrl: string,
  ): Promise<BicepResourceVersionIndex> {
    const { body } = await this.http.getJson(
      `${registryUrl}/${BICEP_TYPES_INDEX_PATH}`,
      BicepResourceVersionIndex,
    );
    return body;
  }
}
