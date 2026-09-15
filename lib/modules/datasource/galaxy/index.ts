import { isNonEmptyString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import * as pep440Versioning from '../../versioning/pep440/index.ts';
import { Datasource } from '../datasource.ts';
import type {
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import { GalaxyV1 } from './schema.ts';

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

  private async _getReleases({
    packageName,
    registryUrl,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const lookUp = packageName.split('.');
    const userName = lookUp[0];
    const projectName = lookUp[1];

    const galaxyAPIUrl = `${registryUrl}api/v1/roles/?owner__username=${userName}&name=${projectName}`;
    const galaxyProjectUrl = `${registryUrl}${userName}/${projectName}`;

    const body = await this.fetchJson(galaxyAPIUrl, GalaxyV1);

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
    if (isNonEmptyString(user) && isNonEmptyString(repo)) {
      result.sourceUrl = `https://github.com/${user}/${repo}`;
    }

    result.releases = versions.map(({ version, releaseTimestamp }) => {
      const release: Release = { version };
      if (releaseTimestamp) {
        release.releaseTimestamp = releaseTimestamp;
      }
      return release;
    });

    return result;
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: 'datasource-galaxy',
        key: config.packageName,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
