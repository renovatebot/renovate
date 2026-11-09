import * as npmVersioning from '../../versioning/npm/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { defaultRegistryUrl } from './common.ts';
import { getDependency } from './get.ts';

export { setNpmrc } from './npmrc.ts';

export class NpmDatasource extends Datasource {
  static readonly id = 'npm';

  override supportsCustomRegistry(_packageName: string): boolean {
    return true;
  }

  override readonly defaultVersioning = npmVersioning.id;

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return [defaultRegistryUrl];
  }

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `time` field in the results.';
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The source URL is determined from the `repository` field in the results.';

  constructor() {
    super(NpmDatasource.id);
  }

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const res = await getDependency(this.http, registryUrl, packageName);
    return res;
  }
}
