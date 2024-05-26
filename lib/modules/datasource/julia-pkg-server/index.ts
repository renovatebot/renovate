import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { Result } from '../../../util/result';
import { joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import {
  PKG_SERVER_REQUEST_HEADERS,
  juliaPkgServerDatasourceId,
} from './common';
import {
  cacheKeyFromRegistryUrl,
  extractFilesFromTarball,
  parseRegistryUrl,
  registryPathForPackage,
} from './registry';
import { Package, Versions } from './schema';

/** The files in a registry defining the metadata for a package. */
type PackageMetadataPath = `${string}/Package.toml` | `${string}/Versions.toml`;

export class JuliaPkgServerDatasource extends Datasource {
  // This URL will redirect to a suitable, geographically near, mirror
  static readonly generalRegistryUrl =
    'https://pkg.julialang.org/registry/23338594-aafe-5451-b93e-139f81909106';

  static readonly id = juliaPkgServerDatasourceId;

  constructor() {
    super(JuliaPkgServerDatasource.id);
  }

  override readonly defaultRegistryUrls = [
    JuliaPkgServerDatasource.generalRegistryUrl,
  ];

  override readonly customRegistrySupport = true;

  // Multiple package servers can contain the same package, but contain
  // different versions of that package
  override readonly registryStrategy = 'merge';

  @cache({
    namespace: `datasource-${juliaPkgServerDatasourceId}-releases`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const registrySpecification = await parseRegistryUrl(
      this.http,
      registryUrl,
    );

    if (!registrySpecification) {
      return null;
    }

    // Hitting the URL for a registry results in a tarball containing the full
    // contents of the registry
    const fullRegistryUrl = joinUrlParts(
      registrySpecification.pkgServer,
      'registry',
      registrySpecification.uuid,
      registrySpecification.state,
    );
    const registry = await this.downloadRegistry(fullRegistryUrl);

    const packagePath = registryPathForPackage(packageName);
    const packageTomlPath: PackageMetadataPath = `${packagePath}/Package.toml`;
    const versionsTomlPath: PackageMetadataPath = `${packagePath}/Versions.toml`;
    const packageMetadataFiles = await extractFilesFromTarball(registry, [
      packageTomlPath,
      versionsTomlPath,
    ]);

    if (!packageMetadataFiles) {
      return null;
    }

    return {
      ...Package.parse(packageMetadataFiles[packageTomlPath]),
      ...Versions.parse(packageMetadataFiles[versionsTomlPath]),
      registryUrl: fullRegistryUrl,
    };
  }

  @cache({
    namespace: `datasource-${juliaPkgServerDatasourceId}-registries`,
    key: (url: string) => cacheKeyFromRegistryUrl(url),
  })
  async downloadRegistry(registryUrl: string): Promise<Buffer> {
    const { val, err } = await Result.wrap(
      this.http.getBuffer(registryUrl, { headers: PKG_SERVER_REQUEST_HEADERS }),
    )
      .transform(({ body }) => body)
      .onError((error) =>
        logger.warn(
          { datasource: JuliaPkgServerDatasource.id, error, registryUrl },
          'An error occurred fetching the registry',
        ),
      )
      .unwrap();

    if (err) {
      this.handleGenericErrors(err);
    }

    return val;
  }
}
