import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { BitbucketTagsDatasource } from '../bitbucket-tags';
import { Datasource } from '../datasource';
import { GitTagsDatasource } from '../git-tags';
import { GithubTagsDatasource } from '../github-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { BaseGoDatasource } from './base';
import { getSourceUrl } from './common';

export class GoDirectDatasource extends Datasource {
  static readonly id = 'go-direct';

  git: GitTagsDatasource;
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

    /**
     * github.com/org/mod/submodule should be tagged as submodule/va.b.c
     * and that tag should be used instead of just va.b.c, although for compatibility
     * the old behaviour stays the same.
     */
    const nameParts = packageName.replace(regEx(/\/v\d+$/), '').split('/');
    logger.trace({ nameParts, releases: res.releases }, 'go.getReleases');

    // If it has more than 3 parts it's a submodule or subgroup (gitlab only)
    if (nameParts.length > 3) {
      const prefix = nameParts.slice(3, nameParts.length).join('/');
      logger.trace(`go.getReleases.prefix:${prefix}`);

      // Filter the releases so that we only get the ones that are for this submodule
      // Also trim the submodule prefix from the version number
      const submodReleases = res.releases
        .filter((release) => release.version?.startsWith(prefix))
        .map((release) => {
          const r2 = release;
          r2.version = r2.version.replace(`${prefix}/`, '');
          return r2;
        });
      logger.trace({ submodReleases }, 'go.getReleases');

      // If not from gitlab -> no subgroups -> must be submodule
      // If from gitlab and directory one level above has tags -> has to be submodule, since groups can't have tags
      // If not, it's simply a repo in a subfolder, and the normal tags are used.
      if (
        !(source.datasource === GitlabTagsDatasource.id) ||
        (source.datasource === GitlabTagsDatasource.id && submodReleases.length)
      ) {
        return {
          sourceUrl,
          releases: submodReleases,
        };
      }
    }

    if (res.releases) {
      res.releases = res.releases.filter(
        (release) => release.version?.startsWith('v'),
      );
    }

    return { ...res, sourceUrl };
  }
}
