import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import * as pep440Versioning from '../../versioning/pep440';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { GalaxyV1 } from './schema';

export class GalaxyDatasource extends Datasource {
  static readonly id = 'galaxy';

  constructor() {
    super(GalaxyDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://galaxy.ansible.com/'];

  override readonly defaultVersioning = pep440Versioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `created` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `github_user` and `github_repo` fields in the results.';

  @cache({
    namespace: 'datasource-galaxy',
    key: (getReleasesConfig: GetReleasesConfig) =>
      getReleasesConfig.packageName,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const lookUp = packageName.split('.');
    const userName = lookUp[0];
    const projectName = lookUp[1];

    const galaxyAPIUrl = `${registryUrl}api/v1/roles/?owner__username=${userName}&name=${projectName}`;
    const galaxyProjectUrl = `${registryUrl}${userName}/${projectName}`;

    let body: GalaxyV1 | null = null;
    try {
      const raw = await this.http.getJson(galaxyAPIUrl, GalaxyV1);
      body = raw.body;
    } catch (err) {
      this.handleGenericErrors(err);
    }

    if (body.results.length > 1) {
      body.results = body.results.filter(
        (result) => result.github_user === userName,
      );
      if (!body.results.length) {
        logger.warn(
          { dependency: packageName, userName },
          `No matching result from galaxy for package`,
        );
        return null;
      }
    }
    if (body.results.length === 0) {
      logger.debug(
        `Received no results for ${packageName} from ${galaxyAPIUrl} `,
      );
      return null;
    }

    const resultObject = body.results[0];
    const versions = resultObject.summary_fields.versions;

    const result: ReleaseResult = {
      releases: [],
    };

    result.dependencyUrl = galaxyProjectUrl;
    const { github_user: user, github_repo: repo } = resultObject;
    if (is.nonEmptyString(user) && is.nonEmptyString(repo)) {
      result.sourceUrl = `https://github.com/${user}/${repo}`;
    }

    result.releases = versions.map(
      (version: { name: string; created?: string }) => {
        const release: Release = {
          version: version.name,
        };

        if (is.nonEmptyString(version.created)) {
          release.releaseTimestamp = version.created;
        }
        return release;
      },
    );

    return result;
  }
}
