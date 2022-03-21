import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export class PuppetDatasource extends Datasource {
  static id = 'puppet';

  constructor() {
    super(PuppetDatasource.id);
  }

  getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult | null> {
    return null;
  }
}
