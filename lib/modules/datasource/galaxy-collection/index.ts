import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import * as p from '../../../util/promises';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url';
import * as pep440Versioning from '../../versioning/pep440';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { GalaxyV3, GalaxyV3DetailedVersion, GalaxyV3Versions } from './schema';

export class GalaxyCollectionDatasource extends Datasource {
  static readonly id = 'galaxy-collection';

  constructor() {
    super(GalaxyCollectionDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://galaxy.ansible.com'];

  override readonly defaultVersioning = pep440Versioning.id;

  @cache({
    namespace: `datasource-${GalaxyCollectionDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const [namespace, projectName] = packageName.split('.');

    const baseUrl = ensureTrailingSlash(
      joinUrlParts(
        registryUrl!,
        'api/v3/plugin/ansible/content/published/collections/index',
        namespace,
        projectName,
      ),
    );

    const { val: baseProject, err: baseErr } = await this.http
      .getJsonSafe(baseUrl, GalaxyV3)
      .onError((err) => {
        logger.warn(
          { datasource: this.id, packageName, err },
          `Error fetching ${baseUrl}`,
        );
      })
      .unwrap();
    if (baseErr) {
      this.handleGenericErrors(baseErr);
    }

    const versionsUrl = ensureTrailingSlash(joinUrlParts(baseUrl, 'versions'));

    const { val: rawReleases, err: versionsErr } = await this.http
      .getJsonSafe(versionsUrl, GalaxyV3Versions)
      .onError((err) => {
        logger.warn(
          { datasource: this.id, packageName, err },
          `Error fetching ${versionsUrl}`,
        );
      })
      .unwrap();
    if (versionsErr) {
      this.handleGenericErrors(versionsErr);
    }

    const releases = rawReleases.map((value) => {
      return {
        ...value,
        isDeprecated: baseProject.deprecated,
      };
    });

    // asynchronously get release details
    const enrichedReleases = await p.map(
      releases,
      (release) => this.getVersionDetails(packageName, versionsUrl, release),
      { concurrency: 4 },
    );

    // filter failed versions
    const filteredReleases = enrichedReleases.filter(is.truthy);
    // extract base information which are only provided on the release from the newest release

    // Find the source URL of the highest version release
    const sourceUrlOfHighestRelease = enrichedReleases.find(
      (release) => baseProject.highest_version.version === release.version,
    )?.sourceUrl;

    return {
      releases: filteredReleases,
      sourceUrl: sourceUrlOfHighestRelease,
    };
  }

  @cache({
    namespace: `datasource-${GalaxyCollectionDatasource.id}-detailed-version`,
    key: (versionsUrl, basicRelease: Release) => basicRelease.version,
    ttlMinutes: 10080, // 1 week
  })
  async getVersionDetails(
    packageName: string,
    versionsUrl: string,
    basicRelease: Release,
  ): Promise<Release> {
    const detailedVersionUrl = ensureTrailingSlash(
      joinUrlParts(versionsUrl, basicRelease.version),
    );
    const { val: rawDetailedVersion, err: versionsErr } = await this.http
      .getJsonSafe(detailedVersionUrl, GalaxyV3DetailedVersion)
      .onError((err) => {
        logger.warn(
          { datasource: this.id, packageName, err },
          `Error fetching ${versionsUrl}`,
        );
      })
      .unwrap();
    if (versionsErr) {
      this.handleGenericErrors(versionsErr);
    }

    return {
      ...rawDetailedVersion,
      isDeprecated: basicRelease.isDeprecated,
    };
  }
}
