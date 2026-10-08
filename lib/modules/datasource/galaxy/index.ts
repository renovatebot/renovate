import { isNonEmptyString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import {
  ensureTrailingSlash,
  joinUrlParts,
  trimTrailingSlash,
} from '../../../util/url.ts';
import * as pep440Versioning from '../../versioning/pep440/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { GalaxyV1 } from './schema.ts';

const defaultRegistryUrl = 'https://galaxy.ansible.com';

export class GalaxyDatasource extends Datasource {
  static readonly id = 'galaxy';

  constructor() {
    super(GalaxyDatasource.id);
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return true;
  }

  override readonly registryStrategy = 'hunt';

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return [defaultRegistryUrl];
  }

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
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const lookUp = packageName.split('.');
    const userName = lookUp[0];
    const projectName = lookUp[1];

    const rolesUrl = ensureTrailingSlash(
      joinUrlParts(registryUrl!, 'api/v1/roles'),
    );
    const galaxyAPIUrl = `${rolesUrl}?owner__username=${userName}&name=${projectName}`;

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

    // The registry URL is an API base. Only the public Galaxy site serves a
    // browsable page.
    if (trimTrailingSlash(registryUrl!) === defaultRegistryUrl) {
      result.dependencyUrl = joinUrlParts(registryUrl!, userName, projectName);
    }

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

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: 'datasource-galaxy',
        key: `getReleases:${config.registryUrl}:${config.packageName}`,
        cacheable: true,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
