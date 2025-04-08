import is from '@sindresorhus/is';
import fs from 'fs';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import { id as bazelVersioningId } from '../../versioning/bazel-module';
import { BzlmodVersion } from '../../versioning/bazel-module/bzlmod-version';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { BazelModuleMetadata } from './schema';

export class BazelDatasource extends Datasource {
  static readonly id = 'bazel';

  static readonly bazelCentralRepoUrl =
    'https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main';

  override readonly defaultRegistryUrls = [BazelDatasource.bazelCentralRepoUrl];
  override readonly registryStrategy = 'hunt';
  override readonly customRegistrySupport = true;
  override readonly caching = true;
  override readonly defaultVersioning = bazelVersioningId;

  static packageMetadataPath(packageName: string): string {
    return `/modules/${packageName}/metadata.json`;
  }

  constructor() {
    super(BazelDatasource.id);
  }

  @cache({
    namespace: `datasource-${BazelDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl!}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const path = BazelDatasource.packageMetadataPath(packageName);
    const url = joinUrlParts(registryUrl!, path);
    console.log('url here', url);
    const result: ReleaseResult = { releases: [] };
    try {
      let metadata;
      // Check if URI is file based or http/https based.
      const FILE_PREFIX = 'file://';
      if (url.startsWith(FILE_PREFIX)) {
        const file = url.slice(FILE_PREFIX.length);
        metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
      } else {
        const response = await this.http.getJson(url, BazelModuleMetadata);
        metadata = response.body;
      }

      result.releases = metadata.versions
        .map((v: string) => new BzlmodVersion(v))
        .sort(BzlmodVersion.defaultCompare)
        .map((bv: BzlmodVersion) => {
          const release: Release = { version: bv.original };
          if (is.truthy(metadata.yanked_versions?.[bv.original])) {
            release.isDeprecated = true;
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
}
