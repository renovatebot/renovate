import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpResponse } from '../../../util/http/types';
import * as p from '../../../util/promises';
import { ensureTrailingSlash, joinUrlParts, parseUrl } from '../../../util/url';
import * as pep440Versioning from '../../versioning/pep440';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type {
  BaseProjectResult,
  BaseProjectResultV2,
  BaseProjectResultV3,
  VersionsDetailResult,
  VersionsProjectResult,
} from './types';

function hasRegistryUrlPathIncluded(registryUrl: string): boolean {
  const urlToCheck = parseUrl(registryUrl);
  if (!is.nullOrUndefined(urlToCheck)) {
    return urlToCheck.pathname.length > 1; // returns "/" for URL without path
  }
  return false;
}

function isBaseProjectResultV2(
  result: BaseProjectResult
): result is BaseProjectResultV2 {
  return is.truthy('latest_version' in result);
}

function isBaseProjectResultV3(
  result: BaseProjectResult
): result is BaseProjectResultV3 {
  return is.truthy('highest_version' in result);
}

function convertBaseProject(
  base: BaseProjectResult
): BaseProjectResultV2 | null {
  if (isBaseProjectResultV2(base)) {
    return base;
  }
  if (isBaseProjectResultV3(base)) {
    return {
      ...base,
      latest_version: base.highest_version,
    };
  }
  return null;
}

export class GalaxyCollectionDatasource extends Datasource {
  static readonly id = 'galaxy-collection';

  constructor() {
    super(GalaxyCollectionDatasource.id);
  }

  override readonly customRegistrySupport = true;

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

    // TODO: types (#7154)
    /* eslint-disable @typescript-eslint/restrict-template-expressions */
    const baseUrl = hasRegistryUrlPathIncluded(registryUrl!)
      ? registryUrl!
      : joinUrlParts(registryUrl!, 'api/v2/collections');
    const galaxyCollectionUrl = joinUrlParts(baseUrl, namespace, projectName);

    let galaxyUrlResponse: HttpResponse<BaseProjectResult>;
    try {
      galaxyUrlResponse = await this.http.getJson<BaseProjectResult>(
        galaxyCollectionUrl
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }

    if (!galaxyUrlResponse?.body) {
      logger.warn(
        { dependency: packageName },
        `Received invalid data from ${galaxyCollectionUrl}`
      );
      return null;
    }

    // then you can use it like this
    const baseProject = convertBaseProject(galaxyUrlResponse.body);
    if (is.nullOrUndefined(baseProject)) {
      logger.debug("couldn't convert response to object");
      return null;
    }

    const versionsUrl = ensureTrailingSlash(
      joinUrlParts(galaxyCollectionUrl, 'versions')
    );

    let versionsUrlResponse: HttpResponse<VersionsProjectResult>;
    try {
      versionsUrlResponse = await this.http.getJson<VersionsProjectResult>(
        versionsUrl
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }

    const versionsProject = versionsUrlResponse.body;

    // galaxy v2 / v3 detection
    if (!is.nullOrUndefined(versionsProject?.data)) {
      //v3
      versionsProject.results = versionsProject.data;
    } // else v2 -> no-op;

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
