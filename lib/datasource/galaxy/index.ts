import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { HttpResponse } from '../../util/http';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { GalaxyResult } from './types';

export class GalaxyDatasource extends Datasource {
  static readonly id = 'galaxy';

  constructor() {
    super(GalaxyDatasource.id);
  }

  readonly customRegistrySupport = false;

  readonly defaultRegistryUrls = ['https://galaxy.ansible.com/'];

  @cache({
    namespace: 'datasource-galaxy',
    key: (getReleasesConfig: GetReleasesConfig) => getReleasesConfig.lookupName,
  })
  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const lookUp = lookupName.split('.');
    const userName = lookUp[0];
    const projectName = lookUp[1];

    const galaxyAPIUrl =
      registryUrl +
      'api/v1/roles/?owner__username=' +
      userName +
      '&name=' +
      projectName;
    const galaxyProjectUrl = registryUrl + userName + '/' + projectName;

    let raw: HttpResponse<GalaxyResult> = null;
    try {
      raw = await this.http.getJson<GalaxyResult>(galaxyAPIUrl);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const body = raw?.body;

    if (!body) {
      logger.warn(
        { dependency: lookupName },
        `Received invalid data from ${galaxyAPIUrl}`
      );
      return null;
    }

    // istanbul ignore if
    if (body.results.length > 1) {
      logger.warn(
        { dependency: lookupName },
        `Received multiple results from ${galaxyAPIUrl}`
      );
      return null;
    }
    if (body.results.length === 0) {
      logger.info(
        { dependency: lookupName },
        `Received no results from ${galaxyAPIUrl}`
      );
      return null;
    }

    const resultObject = body.results[0];
    const versions = resultObject.summary_fields.versions;

    const result: ReleaseResult = {
      releases: [],
    };

    result.dependencyUrl = galaxyProjectUrl;
    const { github_user: user = null, github_repo: repo = null } = resultObject;
    if (typeof user === 'string' && typeof repo === 'string') {
      result.sourceUrl = `https://github.com/${user}/${repo}`;
    }

    result.releases = versions.map(
      (version: { name: string; release_date: string }) => {
        const release: Release = {
          version: version.name,
          releaseTimestamp: version.release_date,
        };

        return release;
      }
    );

    return result;
  }
}
