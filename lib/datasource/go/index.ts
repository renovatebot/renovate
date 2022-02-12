import { cache } from '../../util/cache/package/decorator';
import { Datasource } from '../datasource';
import { GithubTagsDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { BaseGoDatasource } from './base';
import { bitbucket } from './common';
import { GoDirectDatasource } from './releases-direct';
import { GoProxyDatasource } from './releases-goproxy';

export class GoDatasource extends Datasource {
  static readonly id = 'go';

  constructor() {
    super(GoDatasource.id);
  }

  override readonly customRegistrySupport = false;

  readonly goproxy = new GoProxyDatasource();
  readonly direct = new GoDirectDatasource();

  @cache({
    namespace: `datasource-${GoDatasource.id}`,
    key: ({ lookupName }: Partial<DigestConfig>) => `${lookupName}-digest`,
  })
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return process.env.GOPROXY
      ? this.goproxy.getReleases(config)
      : this.direct.getReleases(config);
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
    key: ({ lookupName }: Partial<DigestConfig>) => `${lookupName}-digest`,
  })
  override async getDigest(
    { lookupName }: Partial<DigestConfig>,
    value?: string
  ): Promise<string | null> {
    const source = await BaseGoDatasource.getDatasource(lookupName);
    if (!source) {
      return null;
    }

    // ignore v0.0.0- pseudo versions that are used Go Modules - look up default branch instead
    const tag = value && !value.startsWith('v0.0.0-2') ? value : undefined;

    switch (source.datasource) {
      case GithubTagsDatasource.id: {
        return this.direct.github.getDigest(source, tag);
      }
      case bitbucket.id: {
        return bitbucket.getDigest(source, tag);
      }
      case GitlabTagsDatasource.id: {
        return this.direct.gitlab.getDigest(source, tag);
      }
      /* istanbul ignore next: can never happen, makes lint happy */
      default: {
        return null;
      }
    }
  }
}
