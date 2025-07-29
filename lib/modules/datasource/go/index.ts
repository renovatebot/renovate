import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { getEnv } from '../../../util/env';
import { regEx } from '../../../util/regex';
import { addSecretForSanitizing } from '../../../util/sanitize';
import { parseUrl } from '../../../util/url';
import { id as semverId } from '../../versioning/semver';
import { BitbucketTagsDatasource } from '../bitbucket-tags';
import { Datasource } from '../datasource';
import { GitTagsDatasource } from '../git-tags';
import { GiteaTagsDatasource } from '../gitea-tags';
import { GithubTagsDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { BaseGoDatasource } from './base';
import { parseGoproxy } from './goproxy-parser';
import { GoDirectDatasource } from './releases-direct';
import { GoProxyDatasource } from './releases-goproxy';

export class GoDatasource extends Datasource {
  static readonly id = 'go';

  override readonly defaultVersioning = semverId;

  constructor() {
    super(GoDatasource.id);
  }

  override readonly defaultConfig = {
    commitMessageTopic: 'module {{depName}}',
  };

  override readonly customRegistrySupport = false;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'If the release timestamp is not returned from the respective datasoure used to fetch the releases, then Renovate uses the `Time` field in the results instead.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `packageName` and `registryUrl`.';

  readonly goproxy = new GoProxyDatasource();
  readonly direct = new GoDirectDatasource();

  // Pseudo versions https://go.dev/ref/mod#pseudo-versions
  static readonly pversionRegexp = regEx(
    /v\d+\.\d+\.\d+-(?:\w+\.)?(?:0\.)?\d{14}-(?<digest>[a-f0-9]{12})/,
  );
  @cache({
    namespace: `datasource-${GoDatasource.id}`,
    // TODO: types (#22198)
    key: ({ packageName }: GetReleasesConfig) => `getReleases:${packageName}`,
  })
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.goproxy.getReleases(config);
  }

  /**
   * go.getDigest
   *
   * This datasource resolves a go module URL into its source repository
   *  and then fetches the digest if it is on GitHub.
   *
   * This function will:
   *  - Determine the source URL for the module
   *  - Call the respective getDigest in github to retrieve the commit hash
   */
  @cache({
    namespace: `datasource-${GoDatasource.id}`,
    key: ({ packageName }: DigestConfig, newValue?: string) =>
      `getDigest:${packageName}:${newValue}`,
  })
  override async getDigest(
    { packageName }: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (parseGoproxy().some(({ url }) => url === 'off')) {
      logger.debug(
        `Skip digest fetch for ${packageName} with GOPROXY containing "off"`,
      );
      return null;
    }

    const source = await BaseGoDatasource.getDatasource(packageName);
    if (!source) {
      return null;
    }

    // ignore vX.Y.Z-(0.)? pseudo versions that are used Go Modules - look up default branch instead
    // ignore v0.0.0 versions to fetch the digest of default branch, not the commit of non-existing tag `v0.0.0`
    const tag =
      newValue &&
      !GoDatasource.pversionRegexp.test(newValue) &&
      newValue !== 'v0.0.0'
        ? newValue
        : undefined;

    switch (source.datasource) {
      case GitTagsDatasource.id: {
        return this.direct.git.getDigest(source, tag);
      }
      case GiteaTagsDatasource.id: {
        return this.direct.gitea.getDigest(source, tag);
      }
      case GithubTagsDatasource.id: {
        return this.direct.github.getDigest(source, tag);
      }
      case BitbucketTagsDatasource.id: {
        return this.direct.bitbucket.getDigest(source, tag);
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

const env = getEnv();
/* v8 ignore next 3 -- hard to test */
if (is.string(env.GOPROXY)) {
  const uri = parseUrl(env.GOPROXY);
  if (uri?.password) {
    addSecretForSanitizing(uri.password, 'global');
  } else if (uri?.username) {
    addSecretForSanitizing(uri.username, 'global');
  }
}
