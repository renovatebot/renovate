import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class PuppetDatasource extends Datasource {
  static id = 'puppet';

  constructor() {
    super(PuppetDatasource.id);
  }

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // https://forgeapi.puppet.com
    const moduleResponse = await this.http.get(`${registryUrl}/v3/modules/${packageName}`);

    if(moduleResponse.statusCode !== 200) {
      return null;
    }

    const module = JSON.parse(moduleResponse.body);
    
  }
}
