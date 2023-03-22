import is from '@sindresorhus/is';
import { GenericDatasource } from '../generic';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class GenericJsonDatasource extends GenericDatasource {
  static readonly id = 'generic-json';

  constructor() {
    super(GenericJsonDatasource.id);
  }

  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const response = await this.queryRegistry(registryUrl);

    if (is.nullOrUndefined(response)) {
      return null;
    }

    const jsonObject = JSON.parse(response);

    return this.parseData(packageName, jsonObject);
  }
}
