import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { BitbucketTagsDatasource } from '../bitbucket-tags';
import { Datasource } from '../datasource';
import { GitTagsDatasource } from '../git-tags';
import { GiteaTagsDatasource } from '../gitea-tags';
import { GithubTagsDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { BaseGoDatasource } from './base';
import { getSourceUrl } from './common';

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

export class GoDirectDatasource extends Datasource {
  static readonly id = 'go-direct';

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
  @cache({
    namespace: `datasource-${GoDirectDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
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
      case GitTagsDatasource.id: {
        res = await this.git.getReleases(source);
        break;
      }
      case GiteaTagsDatasource.id: {
        res = await this.gitea.getReleases(source);
        break;
      }
      case GithubTagsDatasource.id: {
        res = await this.github.getReleases(source);
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
      /* istanbul ignore next: can never happen, makes lint happy */
      default: {
        return null;
      }
    }

    // istanbul ignore if
    if (!res) {
      return null;
    }

    const sourceUrl = getSourceUrl(source) ?? null;

    res.releases = filterByPrefix(packageName, res.releases);

    return { ...res, sourceUrl };
  }
}
