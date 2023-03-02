import type { z } from 'zod';
import { cache } from '../../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { BicepTypeIndex } from './schema';

const BICEP_TYPES_INDEX_URL =
  'https://raw.githubusercontent.com/Azure/bicep-types-az/main/generated/index.json';

export class AzureBicepTypesDatasource extends Datasource {
  static readonly id = 'azure-rest-api-spec';

  constructor() {
    super(AzureBicepTypesDatasource.id);
  }

  async getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult | null> {
    const { packageName } = getReleasesConfig;

    const resourceVersionIndex = await this.getResourceVersionIndex();
    const versions = resourceVersionIndex.get(packageName.toLowerCase());

    if (!versions) {
      return null;
    }

    return {
      releases: versions.map((x) => ({
        version: x,
      })),
    };
  }

  @cache({
    namespace: `datasource-${AzureBicepTypesDatasource.id}`,
    key: 'getResourceVersionIndex',
  })
  async getResourceVersionIndex(): Promise<Map<string, string[]>> {
    const res = await this.getBicepTypeIndex();

    const releaseMap = new Map<string, string[]>();

    for (const resourceReference of res.Resources.keys()) {
      const [type, version] = resourceReference.toLowerCase().split('@');
      releaseMap.set(type, [...(releaseMap.get(type) ?? []), version]);
    }

    for (const functionResource of res.Functions.entries()) {
      const [type, versionMap] = functionResource;
      const versions = [...versionMap.keys()];
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
