import { cache } from '../../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { BicepTypeIndex } from './schema';

const BICEP_TYPES_INDEX_URL =
  'https://raw.githubusercontent.com/Azure/bicep-types-az/main/generated/index.json';

export class AzureBicepResourceDatasource extends Datasource {
  static readonly id = 'azure-bicep-resource';

  constructor() {
    super(AzureBicepResourceDatasource.id);
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

    if (!versions) {
      return null;
    }

    const firstSlashIndex = packageName.indexOf('/');
    const namespaceProvider = packageName
      .slice(0, firstSlashIndex)
      .toLowerCase();
    const type = packageName.slice(firstSlashIndex + 1).toLowerCase();

    const changelogUrl = `https://learn.microsoft.com/en-us/azure/templates/${namespaceProvider}/change-log/${type}`;

    return {
      releases: versions.map((x) => ({
        version: x,
        changelogUrl: `${changelogUrl}#${x}`,
      })),
      changelogUrl,
    };
  }

  @cache({
    namespace: `datasource-${AzureBicepResourceDatasource.id}`,
    key: 'getResourceVersionIndex',
    ttlMinutes: 24 * 60,
  })
  async getResourceVersionIndex(): Promise<{ [key: string]: string[] }> {
    const res = await this.getBicepTypeIndex();

    const releaseMap = new Map<string, string[]>();

    for (const resourceReference of Object.keys(res.Resources)) {
      const [type, version] = resourceReference.toLowerCase().split('@', 2);
      releaseMap.set(type, [...(releaseMap.get(type) ?? []), version]);
    }

    for (const functionResource of Object.entries(res.Functions)) {
      const [type, versionMap] = functionResource;
      const versions = Object.keys(versionMap);
      releaseMap.set(type, versions);
    }

    return Object.fromEntries(releaseMap);
  }

  private async getBicepTypeIndex(): Promise<BicepTypeIndex> {
    const res = await this.http.getJson(BICEP_TYPES_INDEX_URL, BicepTypeIndex);
    return res.body;
  }
}
