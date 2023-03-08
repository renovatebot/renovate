import type { z } from 'zod';
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
    const versions = resourceVersionIndex.get(packageName.toLowerCase());

    if (!versions) {
      return null;
    }

    const firstSlashIndex = packageName.indexOf('/');
    const namespaceProvider = packageName
      .slice(0, firstSlashIndex)
      .toLowerCase();
    const type = packageName.slice(firstSlashIndex + 1).toLowerCase();

    const changeLogUrl = `https://learn.microsoft.com/en-us/azure/templates/${namespaceProvider}/change-log/${type}`;

    return {
      releases: versions.map((x) => ({
        version: x,
        changeLogUrl, // TODO: does not show up in PR yet?
      })),
    };
  }

  @cache({
    namespace: `datasource-${AzureBicepResourceDatasource.id}`,
    key: 'getResourceVersionIndex',
    ttlMinutes: 24 * 60,
  })
  async getResourceVersionIndex(): Promise<Map<string, string[]>> {
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

    return releaseMap;
  }

  private getBicepTypeIndex(): Promise<BicepTypeIndex> {
    return this.getJson(BICEP_TYPES_INDEX_URL, BicepTypeIndex);
  }

  private async getJson<T, U extends z.ZodSchema<T>>(
    url: string,
    schema: U
  ): Promise<z.infer<typeof schema>> {
    const { body } = await this.http.getJson(url);
    return schema.parse(body);
  }
}
