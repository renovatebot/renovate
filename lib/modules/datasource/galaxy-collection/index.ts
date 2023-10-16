import is from '@sindresorhus/is';
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

  override readonly defaultRegistryUrls = ['https://galaxy.ansible.com/'];

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
        projectName
      )
    );

    let baseUrlResponse;
    try {
      baseUrlResponse = await this.http.getJson(baseUrl, GalaxyV3);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const baseProject = baseUrlResponse.body;

    const versionsUrl = ensureTrailingSlash(joinUrlParts(baseUrl, 'versions'));

    let versionsUrlResponse;
    try {
      versionsUrlResponse = await this.http.getJson(
        versionsUrl,
        GalaxyV3Versions
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const versionsProject = versionsUrlResponse.body;

    const releases = versionsProject.data.map(
      (value) => {
        const release: Release = {
          version: value.version,
          releaseTimestamp: value.created_at,
          isDeprecated: baseProject.deprecated,
        };
        return release;
      },
      { concurrency: 4 }
    );

    // asynchronously get release details
    const enrichedReleases = await p.map(releases, (release) =>
      this.getVersionDetails(versionsUrl, release)
    );

    // filter failed versions
    const filteredReleases = enrichedReleases.filter(is.truthy);
    // extract base information which are only provided on the release from the newest release

    return {
      releases: filteredReleases,
    };
  }

  @cache({
    namespace: `datasource-${GalaxyCollectionDatasource.id}-detailed-version`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
    ttlMinutes: 10080, // 1 week
  })
  async getVersionDetails(
    versionsUrl: string,
    basicRelease: Release
  ): Promise<Release> {
    const response = await this.http.getJson(
      ensureTrailingSlash(joinUrlParts(versionsUrl, basicRelease.version)),
      GalaxyV3DetailedVersion
    );
    const versionDetails = response.body;
    return {
      version: basicRelease.version,
      isDeprecated: basicRelease.isDeprecated,
      downloadUrl: versionDetails.download_url,
      newDigest: versionDetails.artifact.sha256,
      dependencies: versionDetails.metadata.dependencies,
      sourceUrl: versionDetails.metadata.repository,
    };
  }
}
