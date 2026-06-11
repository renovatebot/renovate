import { withCache } from '../../../util/cache/package/with-cache.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { datasource } from './common.ts';
import { RpmXmlMetadataProvider } from './providers/xml.ts';
import { fetchPrimaryGzipUrl } from './repomd.ts';

export class RpmDatasource extends Datasource {
  static readonly id = datasource;

  private readonly xmlProvider: RpmXmlMetadataProvider;

  constructor() {
    super(RpmDatasource.id);
    this.xmlProvider = new RpmXmlMetadataProvider(this.http);
  }

  /**
   * Users are able to specify custom RPM repositories as long as they follow the format.
   * There is a URI http://linux.duke.edu/metadata/common in the <sha>-primary.xml.
   * But according to this post, it's not something we can really look into or reference.
   * @see{https://lists.rpm.org/pipermail/rpm-ecosystem/2015-October/000283.html}
   */
  override readonly customRegistrySupport = true;

  /**
   * Users can specify multiple repositories and the datasource will aggregate the releases
   * @example
   * Every Fedora release has "release" and "updates" repositories.
   * To get the latest package version, these repositories should be aggregated.
   */
  override readonly registryStrategy = 'merge';

  /**
   * Fetches the release information for a given package from the registry URL.
   *
   * @param registryUrl - the registryUrl should be the folder which contains repodata.xml and its corresponding file list <sha256>-primary.xml.gz, e.g.: https://packages.microsoft.com/azurelinux/3.0/prod/cloud-native/x86_64/repodata/
   * @param packageName - the name of the package to fetch releases for.
   * @returns The release result if the package is found, otherwise null.
   */
  private async _getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl || !packageName) {
      return null;
    }

    try {
      const primaryGzipUrl = await this.getPrimaryGzipUrl(registryUrl);
      return await this.getReleasesByPackageName(primaryGzipUrl, packageName);
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${RpmDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}`,
        ttlMinutes: 1440,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  getPrimaryGzipUrl(registryUrl: string): Promise<string> {
    return withCache(
      {
        namespace: `datasource-${RpmDatasource.id}`,
        key: registryUrl,
        ttlMinutes: 1440,
      },
      () => fetchPrimaryGzipUrl(this.http, registryUrl),
    );
  }

  getReleasesByPackageName(
    primaryGzipUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    return this.xmlProvider.getReleases(primaryGzipUrl, packageName);
  }
}
