import { isTruthy } from '@sindresorhus/is';
import type { NonEmptyArray } from '../../../types/index.ts';
import * as p from '../../../util/promises.ts';
import { regEx } from '../../../util/regex.ts';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url.ts';
import * as pep440Versioning from '../../versioning/pep440/index.ts';
import { RegistryDatasource } from '../datasource.ts';
import type {
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import {
  GalaxyV3,
  GalaxyV3DetailedVersion,
  GalaxyV3Versions,
} from './schema.ts';

const ansibleProtocolRegex = regEx(/^\S+\/api\/ansible\/.+/);
const repositoryRegex = regEx(
  /^\S+\/api\/galaxy\/content\/(?<repository>[^/]+)/,
);

export class GalaxyCollectionDatasource extends RegistryDatasource {
  static readonly id = 'galaxy-collection';

  constructor() {
    super(GalaxyCollectionDatasource.id);
  }

  override supportsCustomRegistry(_packageName: string): boolean {
    return true;
  }

  override readonly registryStrategy = 'hunt';

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return ['https://galaxy.ansible.com/api/'];
  }

  override readonly defaultVersioning = pep440Versioning.id;

  override readonly releaseTimestampSupport = true;
  override releaseTimestampNote =
    'The release timestamp is determined from the `created_at` field in the results.';
  // sourceUrl is returned in each release as well as the ReleaseResult
  // the one present in release result is the sourceUrl of the latest release
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The `sourceUrl` is determined from the `repository` field in the results.';

  private async fetchReleases({
    packageName,
    registryUrl,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const baseUrl = this.constructBaseUrl(registryUrl, packageName);

    const baseProject = await this.fetchJsonOrNull(baseUrl, GalaxyV3);
    if (!baseProject) {
      return null;
    }

    const versionsUrl = ensureTrailingSlash(joinUrlParts(baseUrl, 'versions'));

    const rawReleases = await this.fetchJsonOrNull(
      versionsUrl,
      GalaxyV3Versions,
    );
    if (!rawReleases) {
      return null;
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
      (release) => this.getVersionDetails(versionsUrl, release),
      { concurrency: 4 },
    );

    // filter failed versions
    const filteredReleases = enrichedReleases.filter(isTruthy);
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

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return this.cached(
      {
        key: `getReleases:${config.registryUrl}:${config.packageName}`,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }

  constructBaseUrl(registryUrl: string, packageName: string): string {
    const [namespace, projectName] = packageName.split('.');
    if (ansibleProtocolRegex.test(registryUrl)) {
      return ensureTrailingSlash(
        joinUrlParts(registryUrl, 'api/v3/collections', namespace, projectName),
      );
    }
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

  private async fetchVersionDetails(
    versionsUrl: string,
    basicRelease: Release,
  ): Promise<Release> {
    const detailedVersionUrl = ensureTrailingSlash(
      joinUrlParts(versionsUrl, basicRelease.version),
    );
    const rawDetailedVersion = await this.fetchJson(
      detailedVersionUrl,
      GalaxyV3DetailedVersion,
    );

    return {
      ...rawDetailedVersion,
      isDeprecated: basicRelease.isDeprecated,
      releaseTimestamp: basicRelease.releaseTimestamp,
    };
  }

  getVersionDetails(
    versionsUrl: string,
    basicRelease: Release,
  ): Promise<Release> {
    return this.cached(
      {
        key: `getVersionDetails:${versionsUrl}:${basicRelease.version}`,
        ttlMinutes: 10080, // 1 week
      },
      () => this.fetchVersionDetails(versionsUrl, basicRelease),
    );
  }
}
