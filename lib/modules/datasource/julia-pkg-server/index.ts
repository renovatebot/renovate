import { cache } from '../../../util/cache/package/decorator';
import { Result } from '../../../util/result';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import {
  PKG_SERVER_REQUEST_HEADERS,
  buildRegistryUrl,
  defaultRegistryUrl,
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
  static readonly id = juliaPkgServerDatasourceId;

  constructor() {
    super(juliaPkgServerDatasourceId);
  }

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly customRegistrySupport = true;

  // Multiple package servers can host the same package, but may have
  // different versions of that package
  override readonly registryStrategy = 'merge';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    "The source URL is determined from the `repo` field in a package's `Package.toml`.";

  @cache({
    namespace: `datasource-${juliaPkgServerDatasourceId}-releases`,
    key: ({ packageName, registryUrl }: GetReleasesConfig) =>
      `${registryUrl}:${packageName}`,
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

    // Hitting the URL for a registry results in a tarball of the full
    // contents of the registry
    const fullRegistryUrl = buildRegistryUrl(
      registrySpecification.pkgServer,
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
      .unwrap();

    if (err) {
      this.handleGenericErrors(err);
    }

    return val;
  }
}
