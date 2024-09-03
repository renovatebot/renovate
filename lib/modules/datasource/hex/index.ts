import { promisify } from 'util';
import { gunzip } from 'zlib';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { joinUrlParts } from '../../../util/url';
import * as hexVersioning from '../../versioning/hex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { Package } from './package';
import { HexAPIPackageMetadata } from './schema';
import { Signed } from './signed';

export class HexDatasource extends Datasource {
  static readonly id = 'hex';

  private static readonly hexApiBaseUrl = 'https://hex.pm/api';

  constructor() {
    super(HexDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://repo.hex.pm'];

  override readonly defaultVersioning = hexVersioning.id;

  override readonly releaseTimestampSupport = false;
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `Github` field in the results if the repo has an http API.';

  @cache({
    namespace: `datasource-${HexDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    // Get dependency name from packageName.

    // If the dependency is private packageName contains organization name as following:
    // org:organizationName:hexPackageName
    // hexPackageName is used to pass it in hex dep registry and API urls
    // organizationName is used for accessing to private hexpm deps

    // If the dependency is in a private registry, packageName contains the repo name as following:
    // repo:registryName:hexPackageName
    let urlPath: string;
    let hexRepoName: string = 'hexpm';

    const releaseResult: ReleaseResult = { releases: [] };

    if (packageName.startsWith('org:')) {
      const [, organizationName, hexPackageName] = packageName.split(':');
      urlPath = `/repos/${organizationName}/packages/${hexPackageName}`;
      releaseResult.isPrivate = true;
    } else if (packageName.startsWith('repo:')) {
      const [, repoName, hexPackageName] = packageName.split(':');
      urlPath = `/packages/${hexPackageName}`;
      hexRepoName = repoName;
      releaseResult.isPrivate = true;
    } else {
      urlPath = `/packages/${packageName}`;
    }

    const hexRegistryUrl = joinUrlParts(registryUrl, urlPath);
    logger.trace(`Package registry url: ${hexRegistryUrl}`);

    const resp = await this.http.getBuffer(hexRegistryUrl);

    // istanbul ignore else
    if (resp.statusCode === 200) {
      await decompressBuffer(resp.body)
        .then((signedPackage) => {
          const { payload: payload } = Signed.decode(signedPackage);
          const registryPackage = Package.decode(payload);

          const releases: Release[] = registryPackage.releases.map(
            (rel): Release => {
              const release: Release = { version: rel.version };

              if (rel.retired) {
                release.isDeprecated = true;
              }

              return release;
            },
          );

          releaseResult.releases = releases;

          return releaseResult;
        })
        .catch(
          /* istanbul ignore next */ (err) => {
            return null;
          },
        );

      if (hexRepoName === 'hexpm' && releaseResult.releases.length > 0) {
        const metadataUrl = joinUrlParts(HexDatasource.hexApiBaseUrl, urlPath);

        logger.trace(`Package metadata url: ${metadataUrl}`);

        const { val: packageMetadata, err } = await this.http
          .getJsonSafe(metadataUrl, HexAPIPackageMetadata)
          .unwrap();

        // istanbul ignore if
        if (err) {
          this.handleGenericErrors(err);
        } else {
          releaseResult.changelogUrl = packageMetadata.meta?.links.Changelog;
          releaseResult.sourceUrl = packageMetadata.meta?.links.Github;
          releaseResult.homepage = packageMetadata.html_url;

          const releasesWithMeta = releaseResult.releases.map((rel) => {
            const meta = packageMetadata.releases.find(
              ({ version }) => version === rel.version,
            );

            if (meta) {
              rel.releaseTimestamp = meta.inserted_at;
            }

            return rel;
          });

          releaseResult.releases = releasesWithMeta;

          return releaseResult;
        }
      }

      return releaseResult;
    } else {
      // not sure how to handle error here since get or getBuffer doesn't return an error

      return null;
    }
  }
}

const gunzipAsync = promisify(gunzip);

async function decompressBuffer(buffer: Buffer): Promise<Buffer> {
  return await gunzipAsync(buffer);
}
