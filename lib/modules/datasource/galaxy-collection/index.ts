import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpResponse } from '../../../util/http/types';
import * as p from '../../../util/promises';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type {
  BaseProjectResult,
  VersionsDetailResult,
  VersionsProjectResult,
} from './types';

export class GalaxyCollectionDatasource extends Datasource {
  static readonly id = 'galaxy-collection';

  constructor() {
    super(GalaxyCollectionDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://galaxy.ansible.com/'];

  @cache({
    namespace: `datasource-${GalaxyCollectionDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const [namespace, projectName] = packageName.split('.');

    // TODO: types (#7154)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const baseUrl = `${registryUrl}api/v2/collections/${namespace}/${projectName}/`;

    let baseUrlResponse: HttpResponse<BaseProjectResult>;
    try {
      baseUrlResponse = await this.http.getJson<BaseProjectResult>(baseUrl);
    } catch (err) {
      this.handleGenericErrors(err);
    }

    if (!baseUrlResponse?.body) {
      logger.warn(
        { dependency: packageName },
        `Received invalid data from ${baseUrl}`
      );
      return null;
    }

    const baseProject = baseUrlResponse.body;

    const versionsUrl = `${baseUrl}versions/`;

    let versionsUrlResponse: HttpResponse<VersionsProjectResult>;
    try {
      versionsUrlResponse = await this.http.getJson<VersionsProjectResult>(
        versionsUrl
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const versionsProject = versionsUrlResponse.body;

    const releases: Release[] = versionsProject.results.map((value) => {
      const release: Release = {
        version: value.version,
        isDeprecated: baseProject.deprecated,
      };
      return release;
    });

    let newestVersionDetails: VersionsDetailResult | undefined;
    // asynchronously get release details
    const enrichedReleases: (Release | null)[] = await p.map(
      releases,
      (basicRelease) =>
        this.http
          .getJson<VersionsDetailResult>(
            `${versionsUrl}${basicRelease.version}/`
          )
          .then(
            (versionDetailResultResponse) => versionDetailResultResponse.body
          )
          .then((versionDetails) => {
            try {
              const release: Release = {
                version: basicRelease.version,
                isDeprecated: basicRelease.isDeprecated,
                downloadUrl: versionDetails.download_url,
                newDigest: versionDetails.artifact.sha256,
                dependencies: versionDetails.metadata.dependencies,
              };

              // save details of the newest release for use on the ReleaseResult object
              if (basicRelease.version === baseProject.latest_version.version) {
                newestVersionDetails = versionDetails;
              }
              return release;
            } catch (err) {
              logger.warn(
                { dependency: packageName, err },
                `Received invalid data from ${versionsUrl}${basicRelease.version}/`
              );
              return null;
            }
          })
    );
    // filter failed versions
    const filteredReleases = enrichedReleases.filter(is.truthy);
    // extract base information which are only provided on the release from the newest release
    const result: ReleaseResult = {
      releases: filteredReleases,
      sourceUrl: newestVersionDetails?.metadata.repository,
      homepage: newestVersionDetails?.metadata.homepage,
      tags: newestVersionDetails?.metadata.tags,
    };
    return result;
  }
}
