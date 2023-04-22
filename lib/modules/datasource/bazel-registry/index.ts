import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { BzlmodVersion } from '../../versioning/bazel-module/bzlmod-version';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { BazelModuleMetadataResponse } from './types';

export class BazelRegistryDatasource extends Datasource {
  static readonly id = 'bazel-registry';

  static readonly bazelCentralRepoUrl =
    'https://raw.githubusercontent.com/bazelbuild/bazel-central-registry/main';

  override readonly defaultRegistryUrls = [
    BazelRegistryDatasource.bazelCentralRepoUrl,
  ];
  override readonly registryStrategy = 'hunt';
  override readonly customRegistrySupport = true;
  override readonly caching = true;

  static packageMetatdataPath(packageName: string): string {
    return `/modules/${packageName}/metadata.json`;
  }

  constructor() {
    super(BazelRegistryDatasource.id);
  }

  @cache({
    namespace: `datasource-${BazelRegistryDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl!}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const path = BazelRegistryDatasource.packageMetatdataPath(packageName);
    const url = `${registryUrl!}${path}`;

    const result: ReleaseResult = {
      releases: [],
    };
    try {
      const { body: metadata } =
        await this.http.getJson<BazelModuleMetadataResponse>(url);
      result.releases = metadata.versions
        .filter((v) => !metadata.yanked_versions[v])
        .map((v) => new BzlmodVersion(v))
        .sort(BzlmodVersion.defaultCompare)
        .map((bv) => ({ version: bv.original }));
    } catch (err) {
      // istanbul ignore else: not testable with nock
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
