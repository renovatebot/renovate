import type { z } from 'zod';
import { logger } from '../../../logger';
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

  async getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult | null> {
    const { packageName } = getReleasesConfig;

    logger.info('hello from datasource');

    const resourceVersionIndex = await this.getResourceVersionIndex();
    const versions = resourceVersionIndex.get(packageName.toLowerCase());

    if (!versions) {
      return null;
    }

    logger.info(versions.join(', '));

    return {
      releases: versions.map((x) => ({
        version: x,
      })),
    };
  }

  async getResourceVersionIndex(): Promise<Map<string, string[]>> {
    const res = await this.getBicepTypeIndex();

    const releaseMap = new Map<string, string[]>();

    for (const resourceReference of Object.keys(res.Resources)) {
      const [type, version] = resourceReference.toLowerCase().split('@');
      releaseMap.set(type, [...(releaseMap.get(type) ?? []), version]);
    }

    for (const functionResource in res.Functions) {
      const [type, versionMap] = functionResource;
      const versions = [...Object.keys(versionMap)];
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
