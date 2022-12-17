import is from '@sindresorhus/is';
import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { addSecretForSanitizing } from '../../../util/sanitize';
import { parseUrl } from '../../../util/url';
import { BitBucketTagsDatasource } from '../bitbucket-tags';
import { Datasource } from '../datasource';
import { GitTagsDatasource } from '../git-tags';
import { GithubTagsDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { BaseGoDatasource } from './base';
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

  // Pseudo versions https://go.dev/ref/mod#pseudo-versions
  static readonly pversionRegexp = regEx(
    /v\d+\.\d+\.\d+-(?:\w+\.)?(?:0\.)?\d{14}-(?<digest>[a-f0-9]{12})/
  );
  @cache({
    namespace: `datasource-${GoDatasource.id}`,
    // TODO: types (#7154)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    key: ({ packageName }: Partial<DigestConfig>) => `${packageName}-digest`,
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

    // ignore vX.Y.Z-(0.)? pseudo versions that are used Go Modules - look up default branch instead
    const tag =
      value && !GoDatasource.pversionRegexp.test(value) ? value : undefined;

    switch (source.datasource) {
      case GitTagsDatasource.id: {
        return this.direct.git.getDigest?.(source, tag) ?? null;
      }
      case GithubTagsDatasource.id: {
        return this.direct.github.getDigest(source, tag);
      }
      case BitBucketTagsDatasource.id: {
        return this.direct.bitbucket.getDigest?.(source, tag) ?? null;
      }
      case GitlabTagsDatasource.id: {
        return this.direct.gitlab.getDigest?.(source, tag) ?? null;
      }
      /* istanbul ignore next: can never happen, makes lint happy */
      default: {
        return null;
      }
    }
  }
}

// istanbul ignore if
if (is.string(process.env.GOPROXY)) {
  const uri = parseUrl(process.env.GOPROXY);
  if (uri?.username) {
    addSecretForSanitizing(uri.username, 'global');
  }
  if (uri?.password) {
    addSecretForSanitizing(uri.password, 'global');
  }
}
