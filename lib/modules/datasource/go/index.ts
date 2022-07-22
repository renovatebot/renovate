import { cache } from '../../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { BaseGoDatasource } from './base';
import { GoDirectDatasource } from './releases-direct';

export class GoDatasource extends Datasource {
  static readonly id = 'go';

  constructor() {
    super(GoDatasource.id);
  }

  override readonly customRegistrySupport = false;

  readonly direct = new GoDirectDatasource();

  @cache({
    namespace: `datasource-${GoDatasource.id}`,
    key: ({ packageName }: Partial<DigestConfig>) => `${packageName}-digest`,
  })
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.direct.getReleases(config);
  }

  /**
   * go.getDigest
   *
   * This datasource resolves a go module URL into its source repository
   *  and then fetches the digest it if it is on GitHub.
   *
   * This function will:
   *  - Determine the source URL for the module
   *  - Call the respective getDigest in github to retrieve the commit hash
   */
  @cache({
    namespace: GoDatasource.id,
    key: ({ packageName }: DigestConfig) => `${packageName}-digest`,
  })
  override async getDigest(
    { packageName }: DigestConfig,
    value?: string | null
  ): Promise<string | null> {
    const source = await BaseGoDatasource.getDatasource(packageName);
    if (!source) {
      return null;
    }

    // ignore v0.0.0- pseudo versions that are used Go Modules - look up default branch instead
    const tag = value && !value.startsWith('v0.0.0-2') ? value : undefined;

    return this.direct.git.getDigest(source, tag);
  }
}
