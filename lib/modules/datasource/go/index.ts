import { isString } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { getEnv } from '../../../util/env.ts';
import { containsCommit } from '../../../util/github/compare.ts';
import { GithubHttp } from '../../../util/http/github.ts';
import { regEx } from '../../../util/regex.ts';
import { addSecretForSanitizing } from '../../../util/sanitize.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { parseUrl } from '../../../util/url.ts';
import { id as semverId } from '../../versioning/semver/index.ts';
import { BitbucketTagsDatasource } from '../bitbucket-tags/index.ts';
import { Datasource } from '../datasource.ts';
import { ForgejoTagsDatasource } from '../forgejo-tags/index.ts';
import { GitTagsDatasource } from '../git-tags/index.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  PostprocessReleaseConfig,
  PostprocessReleaseResult,
  Release,
  ReleaseResult,
} from '../types.ts';
import { BaseGoDatasource } from './base.ts';
import { isPublicGoPackage } from './common.ts';
import { parseGoproxy } from './goproxy-parser.ts';
import { GoDirectDatasource } from './releases-direct.ts';
import {
  GoProxyDatasource,
  pseudoVersionToRelease,
} from './releases-goproxy.ts';

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

  readonly goproxy = new GoProxyDatasource();
  readonly direct = new GoDirectDatasource();
  private readonly githubHttp = new GithubHttp(GithubTagsDatasource.id);

  // Pseudo versions https://go.dev/ref/mod#pseudo-versions
  static readonly pversionRegexp = regEx(
    /v\d+\.\d+\.\d+-(?:\w+\.)?(?:0\.)?\d{14}-(?<digest>[a-f0-9]{12})/,
  );

  private _getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return this.goproxy.getReleases(config);
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const constraintsFilteringKey =
      config.constraintsFiltering && config.constraintsFiltering !== 'none'
        ? `@@${config.constraintsFiltering}`
        : '';
    return withCache(
      {
        namespace: `datasource-${GoDatasource.id}`,
        // TODO: types (#22198)
        key: `getReleases:${config.packageName}@@${constraintsFilteringKey}`,
        cacheable: isPublicGoPackage(config.packageName),
        fallback: true,
      },
      () => this._getReleases(config),
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
      newValue &&
      !GoDatasource.pversionRegexp.test(newValue) &&
      newValue !== 'v0.0.0'
        ? newValue
        : undefined;

    switch (source.datasource) {
      case ForgejoTagsDatasource.id: {
        return this.direct.forgejo.getDigest(source, tag);
      }
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
      /* v8 ignore next: can never happen, makes lint happy */
      default: {
        return null;
      }
    }
  }

  override getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: `datasource-${GoDatasource.id}`,
        key: `getDigest:${config.packageName}:${newValue}`,
        cacheable: isPublicGoPackage(config.packageName),
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }

  /**
   * Whether the commit of the release contains `commit`, if the source host of
   * the module can tell.
   */
  private async releaseContainsCommit(
    packageName: string,
    version: string,
    commit: string,
  ): Promise<boolean | null> {
    const source = await BaseGoDatasource.getDatasource(packageName);
    if (source?.datasource !== GithubTagsDatasource.id) {
      return null;
    }
    const releaseCommit = await this.getDigest({ packageName }, version);
    if (!releaseCommit) {
      return null;
    }
    try {
      return await withCache(
        {
          namespace: `datasource-${GoDatasource.id}`,
          key: `containsCommit:${source.packageName}:${commit}:${releaseCommit}`,
          cacheable: isPublicGoPackage(packageName),
        },
        () =>
          containsCommit(
            this.githubHttp,
            source.registryUrl,
            source.packageName,
            commit,
            releaseCommit,
          ),
      );
    } catch (err) {
      logger.debug(
        { err, packageName, version },
        'Could not compare the release with the pinned commit',
      );
      return null;
    }
  }

  /**
   * A pseudo-version pins a commit, and Go names it after the latest release
   * before that commit, so a release on another branch can sort higher without
   * containing it, such as a hotfix. Updating to it would drop commits, so it
   * is rejected - see #44184. Where the source host cannot compare commits, a
   * release older than the pinned commit is rejected, as it cannot contain it.
   */
  override async postprocessRelease(
    { packageName, currentValue }: PostprocessReleaseConfig,
    release: Release,
  ): Promise<PostprocessReleaseResult> {
    const pinned = currentValue ? pseudoVersionToRelease(currentValue) : null;
    // A newer pseudo-version is the newest commit of a module without releases
    if (!pinned?.newDigest || pseudoVersionToRelease(release.version)) {
      return release;
    }
    const containsPinned =
      (await this.releaseContainsCommit(
        packageName,
        release.version,
        pinned.newDigest,
      )) ?? !isOlder(release.releaseTimestamp, pinned.releaseTimestamp);
    return containsPinned ? release : 'reject';
  }
}

function isOlder(
  timestamp: Timestamp | null | undefined,
  other: Timestamp | null | undefined,
): boolean {
  return (
    !!timestamp &&
    !!other &&
    DateTime.fromISO(timestamp) < DateTime.fromISO(other)
  );
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
