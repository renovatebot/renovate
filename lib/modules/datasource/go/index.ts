import { isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { getEnv } from '../../../util/env.ts';
import { addSecretForSanitizing } from '../../../util/sanitize.ts';
import { parseUrl } from '../../../util/url.ts';
import { id as semverId } from '../../versioning/semver/index.ts';
import { Datasource } from '../datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import { BaseGoDatasource } from './base.ts';
import { isPublicGoPackage, pseudoVersionRegex } from './common.ts';
import { parseGoproxy } from './goproxy-parser.ts';
import { getGoproxyReleases, getReleasesCacheKey } from './releases-goproxy.ts';
import { getGoTagDatasource } from './tag-datasources.ts';

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
    'If the release timestamp is not returned from the respective datasoure used to fetch the releases, then Renovate uses the `Time` field in the results instead. For modules hosted on GitHub, a later GitHub Release publication time takes precedence over both.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `packageName` and `registryUrl`.';

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: `getReleases:${getReleasesCacheKey(config)}`,
        cacheable: isPublicGoPackage(config.packageName),
        fallback: true,
      },
      () => getGoproxyReleases(config),
    );
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
  private async _getDigest(
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
      newValue && !pseudoVersionRegex.test(newValue) && newValue !== 'v0.0.0'
        ? newValue
        : undefined;

    const tagDatasource = getGoTagDatasource(source.datasource);
    /* v8 ignore next: can never happen, makes lint happy */
    if (!tagDatasource) {
      return null;
    }

    // `getDatasource()` resolves a registry URL for every datasource except
    // `git-tags`, which ignores it.
    const sourceConfig = { ...source, registryUrl: source.registryUrl! };

    return tagDatasource.api.getDigest(sourceConfig, tag);
  }

  override getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return this.cached(
      {
        key: `getDigest:${config.packageName}:${newValue}`,
        cacheable: isPublicGoPackage(config.packageName),
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }
}

const env = getEnv();
/* v8 ignore if -- hard to test */
if (isString(env.GOPROXY)) {
  const uri = parseUrl(env.GOPROXY);
  if (uri?.password) {
    addSecretForSanitizing(uri.password, 'global');
  } else if (uri?.username) {
    addSecretForSanitizing(uri.username, 'global');
  }
}
