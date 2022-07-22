import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { Datasource } from '../datasource';
import { GitTagsDatasource } from '../git-tags';
import { GitlabTagsDatasource } from '../gitlab-tags';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { BaseGoDatasource } from './base';
import { getSourceUrl } from './common';

export class GoDirectDatasource extends Datasource {
  static readonly id = 'go-direct';

  git: GitTagsDatasource;

  constructor() {
    super(GoDirectDatasource.id);
    this.git = new GitTagsDatasource();
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

    logger.trace(`go.getReleases(${packageName})`);
    const source = await BaseGoDatasource.getDatasource(packageName);

    if (!source) {
      logger.info(
        { packageName },
        'Unsupported go host - cannot look up versions'
      );
      return null;
    }

    const sourceUrl = getSourceUrl(source);

    if (!sourceUrl) {
      return null;
    }

    /**
     * github.com/org/mod/submodule should be tagged as submodule/va.b.c
     * and that tag should be used instead of just va.b.c, although for compatibility
     * the old behaviour stays the same.
     */
    const nameParts = packageName.replace(regEx(/\/v\d+$/), '').split('/');

    const prefix: string[] = ['refs/tags'];
    let submodPath: string | null = null;

    // If it has more than 3 parts it's a submodule or subgroup (gitlab only)
    if (nameParts.length > 3) {
      submodPath = nameParts.slice(3, nameParts.length).join('/');
      prefix.push(submodPath);
      logger.trace(`go.getReleases.prefix:${submodPath}`);
    }

    prefix.push('v');

    let res = await this.git.getReleases({
      packageName: sourceUrl,
      filter: {
        prefix: prefix.join('/'),
      },
    });

    // istanbul ignore if
    if (!res) {
      return null;
    }

    // If from gitlab and no submodule tags, fallback to normal tag
    if (!res.releases.length && source.datasource === GitlabTagsDatasource.id) {
      submodPath = null;
      res = await this.git.getReleases({
        packageName: sourceUrl,
        filter: {
          prefix: 'refs/tags/v',
        },
      });

      // istanbul ignore if
      if (!res) {
        return null;
      }
    }

    if (submodPath) {
      // Filter the releases so that we only get the ones that are for this submodule
      // Also trim the submodule prefix from the version number
      const submodReleases = res.releases.map((release) => {
        const r2 = release;
        r2.version = r2.version.replace(`${submodPath}/`, '');
        return r2;
      });
      logger.trace({ submodReleases }, 'go.getReleases');

      return {
        sourceUrl,
        releases: submodReleases,
      };
    }
    logger.trace({ nameParts, releases: res.releases }, 'go.getReleases');

    return { ...res, sourceUrl };
  }
}
