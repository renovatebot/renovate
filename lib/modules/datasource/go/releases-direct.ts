import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { regEx } from '../../../util/regex.ts';
import { parseUrl } from '../../../util/url.ts';
import { BitbucketTagsDatasource } from '../bitbucket-tags/index.ts';
import { Datasource } from '../datasource.ts';
import { ForgejoTagsDatasource } from '../forgejo-tags/index.ts';
import { GitTagsDatasource } from '../git-tags/index.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { BaseGoDatasource } from './base.ts';
import { getSourceUrl, isPublicGoPackage } from './common.ts';

/**
 * This function tries to select tags with longest prefix could be constructed from `packageName`.
 *
 * For package named `example.com/foo/bar/baz/qux`, it will try to detect tags with following prefixes:
 *
 *   - `foo/bar/baz/qux/vX.Y.Z`
 *   - `bar/baz/qux/vX.Y.Z`
 *   - `baz/qux/vX.Y.Z`
 *   - `qux/vX.Y.Z`
 *
 * If none of the following is found, it falls back to simply returning all tags like `vX.Y.Z`.
 */
function filterByPrefix(packageName: string, releases: Release[]): Release[] {
  const nameParts = packageName
    .replace(regEx(/\/v\d+$/), '')
    .split('/')
    .slice(1);

  const submoduleReleases: Release[] = [];
  while (nameParts.length) {
    const prefix = `${nameParts.join('/')}/`;

    for (const release of releases) {
      if (!release.version.startsWith(prefix)) {
        continue;
      }

      const normalizedVersion = release.version.replace(prefix, '');
      if (!normalizedVersion.match(regEx(/^v\d[^/]*/))) {
        continue;
      }

      release.version = release.version.replace(prefix, '');
      submoduleReleases.push(release);
    }

    if (submoduleReleases.length) {
      return submoduleReleases;
    }

    nameParts.shift();
  }

  return releases.filter((release) => release.version.startsWith('v'));
}

/**
 * Returns the tag prefix (e.g. `service/s3/`) of a Go module located in a subdirectory of its GitHub repository, or `null` for a module at the repository root.
 */
function getGithubSubmoduleRefQuery(
  packageName: string,
  source: GetReleasesConfig,
): string | null {
  const host = parseUrl(source.registryUrl)?.host;
  if (!host) {
    return null;
  }

  const modulePath = packageName.replace(regEx(/\/v\d+$/), '');
  const repoPath = `${host}/${source.packageName}/`;
  if (!modulePath.startsWith(repoPath)) {
    return null;
  }

  return `${modulePath.slice(repoPath.length)}/`;
}

export class GoDirectDatasource extends Datasource {
  static readonly id = 'go-direct';

  readonly forgejo = new ForgejoTagsDatasource();
  git: GitTagsDatasource;
  readonly gitea = new GiteaTagsDatasource();
  github: GithubTagsDatasource;
  gitlab: GitlabTagsDatasource;
  bitbucket: BitbucketTagsDatasource;

  constructor() {
    super(GoDirectDatasource.id);
    this.git = new GitTagsDatasource();
    this.github = new GithubTagsDatasource();
    this.gitlab = new GitlabTagsDatasource();
    this.bitbucket = new BitbucketTagsDatasource();
  }

  /**
   * Fetches the GitHub tags of the repository hosting `packageName`.
   *
   * For a module in a repository subdirectory, the tags are first queried scoped to the subdirectory prefix, falling back to all tags when the scoped query yields no matching tag.
   */
  private async getGithubReleases(
    packageName: string,
    source: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const refQuery = getGithubSubmoduleRefQuery(packageName, source);
    if (!refQuery) {
      return this.github.getReleases(source);
    }

    const scoped = await this.github.getReleases({ ...source, refQuery });
    const hasPrefixedTag = scoped?.releases.some((release) =>
      release.version.startsWith(refQuery),
    );
    if (hasPrefixedTag) {
      return scoped;
    }

    logger.debug(
      `No ${refQuery} tags found for ${packageName}, falling back to all tags`,
    );
    return this.github.getReleases(source);
  }

  /**
   * go.getReleases
   *
   * This datasource resolves a go module URL into its source repository
   *  and then fetch it if it is on GitHub.
   *
   * This function will:
   *  - Determine the source URL for the module
   *  - Call the respective getReleases in github/gitlab to retrieve the tags
   *  - Filter module tags according to the module path
   */
  private async _getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const { packageName } = config;

    let res: ReleaseResult | null = null;

    logger.trace(`go.getReleases(${packageName})`);
    const source = await BaseGoDatasource.getDatasource(packageName);

    if (!source) {
      logger.info(
        { packageName },
        'Unsupported go host - cannot look up versions',
      );
      return null;
    }

    switch (source.datasource) {
      case ForgejoTagsDatasource.id: {
        res = await this.forgejo.getReleases(source);
        break;
      }
      case GitTagsDatasource.id: {
        res = await this.git.getReleases(source);
        break;
      }
      case GiteaTagsDatasource.id: {
        res = await this.gitea.getReleases(source);
        break;
      }
      case GithubTagsDatasource.id: {
        res = await this.getGithubReleases(packageName, source);
        break;
      }
      case GitlabTagsDatasource.id: {
        res = await this.gitlab.getReleases(source);
        break;
      }
      case BitbucketTagsDatasource.id: {
        res = await this.bitbucket.getReleases(source);
        break;
      }
      /* v8 ignore next -- should never happen */
      default: {
        return null;
      }
    }

    /* v8 ignore next -- TODO: add test */
    if (!res) {
      return null;
    }

    const sourceUrl = res.sourceUrl ?? getSourceUrl(source) ?? null;

    return {
      ...res,
      releases: filterByPrefix(packageName, res.releases),
      sourceUrl,
      effectiveDatasource: source.datasource,
    };
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${GoDirectDatasource.id}`,
        key: config.packageName,
        public: isPublicGoPackage(config.packageName),
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
