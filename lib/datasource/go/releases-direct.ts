import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { regEx } from '../../util/regex';
import { Datasource } from '../datasource';
import { GithubTagsDatasource } from '../github-tags';
import * as gitlab from '../gitlab-tags';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { BaseGoDatasource } from './base';
import { bitbucket, getSourceUrl } from './common';

export class GoDirectDatasource extends Datasource {
  static readonly id = 'go-direct';

  github: GithubTagsDatasource;

  constructor() {
    super(GoDirectDatasource.id);
    this.github = new GithubTagsDatasource();
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
    key: ({ lookupName }: GetReleasesConfig) => lookupName,
  })
  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { lookupName } = config;

    let res: ReleaseResult = null;

    logger.trace(`go.getReleases(${lookupName})`);
    const source = await BaseGoDatasource.getDatasource(lookupName);

    if (!source) {
      logger.info(
        { lookupName },
        'Unsupported go host - cannot look up versions'
      );
      return null;
    }

    switch (source.datasource) {
      case GithubTagsDatasource.id: {
        res = await this.github.getReleases(source);
        break;
      }
      case gitlab.id: {
        res = await gitlab.getReleases(source);
        break;
      }
      case bitbucket.id: {
        res = await bitbucket.getReleases(source);
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

    const sourceUrl = getSourceUrl(source);

    /**
     * github.com/org/mod/submodule should be tagged as submodule/va.b.c
     * and that tag should be used instead of just va.b.c, although for compatibility
     * the old behaviour stays the same.
     */
    const nameParts = lookupName.replace(regEx(/\/v\d+$/), '').split('/');
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
        !(source.datasource === gitlab.id) ||
        (source.datasource === gitlab.id && submodReleases.length)
      ) {
        return {
          sourceUrl,
          releases: submodReleases,
        };
      }
    }

    if (res.releases) {
      res.releases = res.releases.filter((release) =>
        release.version?.startsWith('v')
      );
    }

    return { ...res, sourceUrl };
  }
}
