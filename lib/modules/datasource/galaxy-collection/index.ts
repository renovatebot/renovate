import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import * as p from '../../../util/promises';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url';
import * as pep440Versioning from '../../versioning/pep440';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { GalaxyV3, GalaxyV3DetailedVersion, GalaxyV3Versions } from './schema';

const ansibleProtocolRegex = regEx(/^\S+\/api\/ansible\/.+/);
const repositoryRegex = regEx(
  /^\S+\/api\/galaxy\/content\/(?<repository>[^/]+)/,
);

export class GalaxyCollectionDatasource extends Datasource {
  static readonly id = 'galaxy-collection';

  constructor() {
    super(GalaxyCollectionDatasource.id);
  }

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'hunt';

  override readonly defaultRegistryUrls = ['https://galaxy.ansible.com/api/'];

  override readonly defaultVersioning = pep440Versioning.id;

  override readonly releaseTimestampSupport = true;
  override releaseTimestampNote =
    'The release timestamp is determined from the `created_at` field in the results.';
  // sourceUrl is returned in each release as well as the ReleaseResult
  // the one present in release result is the sourceUrl of the latest release
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The `sourceUrl` is determined from the `repository` field in the results.';

  @cache({
    namespace: `datasource-${GalaxyCollectionDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => `getReleases:${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const baseUrl = this.constructBaseUrl(registryUrl!, packageName);

    const { val: baseProject, err: baseErr } = await this.http
      .getJsonSafe(baseUrl, GalaxyV3)
      .onError((err) => {
        if (!(err instanceof HttpError && err.response?.statusCode === 404)) {
          logger.warn(
            { url: baseUrl, datasource: this.id, packageName, err },
            'Error fetching from url',
          );
        }
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
          { url: versionsUrl, datasource: this.id, packageName, err },
          'Error fetching from url',
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

  constructBaseUrl(registryUrl: string, packageName: string): string {
    const [namespace, projectName] = packageName.split('.');
    if (ansibleProtocolRegex.test(registryUrl)) {
      return ensureTrailingSlash(
        joinUrlParts(registryUrl, 'api/v3/collections', namespace, projectName),
      );
    } else {
      const repository =
        repositoryRegex.exec(registryUrl)?.groups?.repository ?? 'published';
      return ensureTrailingSlash(
        joinUrlParts(
          registryUrl,
          'v3/plugin/ansible/content',
          repository,
          'collections/index',
          namespace,
          projectName,
        ),
      );
    }
  }

  @cache({
    namespace: `datasource-${GalaxyCollectionDatasource.id}`,
    key: (_packageName: string, versionsUrl: string, basicRelease: Release) =>
      `getVersionDetails:${versionsUrl}:${basicRelease.version}`,
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
          { url: versionsUrl, datasource: this.id, packageName, err },
          'Error fetching from url',
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
