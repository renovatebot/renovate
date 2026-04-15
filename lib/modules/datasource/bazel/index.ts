import { isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { isValidLocalPath, readLocalFile } from '../../../util/fs/index.ts';
import { HttpError } from '../../../util/http/index.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { BzlmodVersion } from '../../versioning/bazel-module/bzlmod-version.ts';
import { id as bazelVersioningId } from '../../versioning/bazel-module/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { BazelModuleMetadata, BcrPageData } from './schema.ts';

const nextDataRegex =
  /<script id="__NEXT_DATA__" type="application\/json">(?<json>.+?)<\/script>/s;

export class BazelDatasource extends Datasource {
  static readonly id = 'bazel';

  static readonly bazelCentralRepoUrl =
    'https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main';

  static readonly bcrUiBaseUrl = 'https://registry.bazel.build';

  override readonly defaultRegistryUrls = [BazelDatasource.bazelCentralRepoUrl];
  override readonly registryStrategy = 'hunt';
  override readonly customRegistrySupport = true;
  override readonly caching = true;
  override readonly defaultVersioning = bazelVersioningId;
  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the BCR UI commit dates at registry.bazel.build. Timestamps are fetched for any remote registry (including BCR mirrors/proxies) but not for file-based registries.';

  static packageMetadataPath(packageName: string): string {
    return `/modules/${packageName}/metadata.json`;
  }

  constructor() {
    super(BazelDatasource.id);
  }

  private async getVersionTimestamps(
    packageName: string,
  ): Promise<Map<string, Timestamp>> {
    const timestamps = new Map<string, Timestamp>();
    try {
      const url = `${BazelDatasource.bcrUiBaseUrl}/modules/${packageName}`;
      const response = await this.http.getText(url);
      const match = nextDataRegex.exec(response.body);
      if (!match?.groups?.json) {
        logger.debug(
          { packageName },
          'Bazel: failed to extract __NEXT_DATA__ from BCR UI page',
        );
        return timestamps;
      }

      const pageData = BcrPageData.parse(JSON.parse(match.groups.json));
      for (const info of pageData.props.pageProps.versionInfos) {
        if (info.submission.authorDateIso) {
          timestamps.set(info.version, info.submission.authorDateIso);
        }
      }
    } catch (err) {
      logger.debug(
        { packageName, err },
        'Bazel: failed to fetch version timestamps from BCR UI',
      );
    }
    return timestamps;
  }

  private async _getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const path = BazelDatasource.packageMetadataPath(packageName);
    const url = joinUrlParts(registryUrl!, path);
    const result: ReleaseResult = { releases: [] };
    try {
      let metadata: BazelModuleMetadata;
      const FILE_PREFIX = 'file://';
      if (url.startsWith(FILE_PREFIX)) {
        const filePath = url.slice(FILE_PREFIX.length);
        if (!isValidLocalPath(filePath)) {
          return null;
        }
        const fileContent = await readLocalFile(filePath, 'utf8');
        if (!fileContent) {
          return null;
        }
        metadata = BazelModuleMetadata.parse(JSON.parse(fileContent));
      } else {
        const response = await this.http.getJson(url, BazelModuleMetadata);
        metadata = response.body;
      }

      if (!metadata.versions.length) {
        return null;
      }

      const timestamps = url.startsWith('file://')
        ? new Map<string, Timestamp>()
        : await this.getVersionTimestamps(packageName);

      result.releases = metadata.versions
        .map((v) => new BzlmodVersion(v))
        .sort(BzlmodVersion.defaultCompare)
        .map((bv) => {
          const release: Release = { version: bv.original };
          if (isTruthy(metadata.yanked_versions?.[bv.original])) {
            release.isDeprecated = true;
          }
          const releaseTimestamp = timestamps.get(bv.original);
          if (releaseTimestamp) {
            release.releaseTimestamp = releaseTimestamp;
          }
          return release;
        });
      if (metadata.homepage) {
        result.homepage = metadata.homepage;
      }
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.response?.statusCode === 404) {
          return null;
        }
        throw new ExternalHostError(err);
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${BazelDatasource.id}`,
        key: `${config.registryUrl!}:${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
