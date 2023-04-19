import { ExternalHostError } from '../../../types/errors/external-host-error';
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

  static packageMetatdataPath(packageName: string): string {
    return `/modules/${packageName}/metadata.json`;
  }

  constructor() {
    super(BazelRegistryDatasource.id);
  }

  // TODO(grindel): Figure out what the cache settings should be!
  // import { cache } from '../../../util/cache/package/decorator';
  // override readonly caching = true;
  // @cache({
  //   namespace: `datasource-${BazelRegistryDatasource.id}`,
  //   key: ({ registryUrl, packageName }: GetReleasesConfig) =>
  //     // TODO: types (#7154)
  //     `${registryUrl!}:${getImageType(packageName)}`,
  // })
  //
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const path = BazelRegistryDatasource.packageMetatdataPath(packageName);
    const url = `${registryUrl!}${path}`;

    const result: ReleaseResult = {
      registryUrl: url,
      releases: [],
    };
    try {
      const { body: metadata } =
        await this.http.getJson<BazelModuleMetadataResponse>(url);
      // TODO(grindel): Revert to simplified form if approved by maintainers.
      // https://renovatebot.slack.com/archives/CAFH752JU/p1681933718434939
      // bzlmodVersions.sort(BzlmodVersion.defaultCompare);
      const bzlmodVersions = metadata.versions
        .filter((v) => !metadata.yanked_versions[v])
        .map((v) => new BzlmodVersion(v))
        .sort((a, b) => BzlmodVersion.defaultCompare(a, b));
      for (const bv of bzlmodVersions) {
        const release = { registryUrl, version: bv.original };
        result.releases.push(release);
      }
    } catch (err) {
      // istanbul ignore else: not testable with nock
      if (err instanceof HttpError) {
        if (err.response?.statusCode !== 404) {
          throw new ExternalHostError(err);
        }
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}
