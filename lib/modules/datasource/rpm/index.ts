import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { parseUrl } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { datasource } from './common.ts';
import { RpmSqliteMetadataProvider } from './providers/sqlite.ts';
import { RpmXmlMetadataProvider } from './providers/xml.ts';
import {
  type RpmRepositoryMetadata,
  fetchPrimaryGzipUrl,
  fetchRepositoryMetadata,
} from './repomd.ts';

type RpmMetadataSource = 'primary' | 'primary_db';
type ResolvedRpmMetadataSource = 'auto' | RpmMetadataSource;

interface ParsedRpmRegistryUrl {
  metadataSource: ResolvedRpmMetadataSource;
  registryUrl: string;
}

interface RpmMetadataProvider {
  readonly metadataType: RpmMetadataSource;
  getReleases(
    metadataUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null>;
}

export class RpmDatasource extends Datasource {
  static readonly id = datasource;

  private readonly providers: Record<RpmMetadataSource, RpmMetadataProvider>;

  constructor() {
    super(RpmDatasource.id);
    const xmlProvider = new RpmXmlMetadataProvider(this.http);
    const sqliteProvider = new RpmSqliteMetadataProvider(this.http);
    this.providers = {
      [xmlProvider.metadataType]: xmlProvider,
      [sqliteProvider.metadataType]: sqliteProvider,
    };
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
      const parsedRegistryUrl = this.parseRegistryUrl(registryUrl);
      const metadata = await this.getRepositoryMetadata(
        parsedRegistryUrl.registryUrl,
      );

      if (parsedRegistryUrl.metadataSource !== 'auto') {
        return await this.getProviderReleases(
          parsedRegistryUrl.metadataSource,
          metadata,
          packageName,
        );
      }

      return await this.getAutoReleases(
        metadata,
        packageName,
        parsedRegistryUrl.registryUrl,
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const parsedRegistryUrl = config.registryUrl
      ? this.parseRegistryUrl(config.registryUrl)
      : undefined;
    const metadataSource = parsedRegistryUrl?.metadataSource ?? 'auto';

    return await withCache(
      {
        namespace: `datasource-${RpmDatasource.id}`,
        key: `${parsedRegistryUrl?.registryUrl}:${config.packageName}:${metadataSource}`,
        ttlMinutes: 1440,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private parseRegistryUrl(registryUrl: string): ParsedRpmRegistryUrl {
    const parsedUrl = parseUrl(registryUrl);
    if (!parsedUrl) {
      return { metadataSource: 'auto', registryUrl };
    }

    const rpmMetadataSource = new URLSearchParams(parsedUrl.hash.slice(1)).get(
      'rpmMetadataSource',
    );

    if (rpmMetadataSource === null) {
      return { metadataSource: 'auto', registryUrl };
    }

    if (rpmMetadataSource === 'primary' || rpmMetadataSource === 'primary_db') {
      parsedUrl.hash = '';
      return {
        metadataSource: rpmMetadataSource,
        registryUrl: parsedUrl.href,
      };
    }

    if (rpmMetadataSource !== 'auto') {
      throw new Error(
        `Invalid rpmMetadataSource in RPM registry URL: ${rpmMetadataSource}`,
      );
    }

    parsedUrl.hash = '';
    return {
      metadataSource: 'auto',
      registryUrl: parsedUrl.href,
    };
  }

  private async getAutoReleases(
    metadata: RpmRepositoryMetadata,
    packageName: string,
    registryUrl: string,
  ): Promise<ReleaseResult | null> {
    const { primaryDbUrl, primaryGzipUrl } = metadata;
    let sqliteError: Error | undefined;

    if (primaryDbUrl) {
      try {
        return await this.getProviderReleases(
          'primary_db',
          metadata,
          packageName,
        );
      } catch (err) {
        sqliteError = err instanceof Error ? err : new Error(String(err));
        logger.debug(
          {
            datasource: RpmDatasource.id,
            err,
            packageName,
            registryUrl,
            repodataType: 'primary_db',
            url: primaryDbUrl,
          },
          'Failed to query primary_db metadata, falling back to primary.xml.gz',
        );
      }
    }

    if (primaryGzipUrl) {
      return await this.getProviderReleases('primary', metadata, packageName);
    }

    if (sqliteError) {
      throw sqliteError;
    }

    return null;
  }

  private async getProviderReleases(
    metadataType: RpmMetadataSource,
    metadata: RpmRepositoryMetadata,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    const metadataUrl = this.getMetadataUrlOrThrow(metadata, metadataType);

    return await this.providers[metadataType].getReleases(
      metadataUrl,
      packageName,
    );
  }

  private getRepositoryMetadata(
    registryUrl: string,
  ): Promise<RpmRepositoryMetadata> {
    return withCache(
      {
        namespace: `datasource-${RpmDatasource.id}`,
        key: `repomd:${registryUrl}`,
        ttlMinutes: 1440,
      },
      () => fetchRepositoryMetadata(this.http, registryUrl),
    );
  }

  getPrimaryGzipUrl(registryUrl: string): Promise<string> {
    const parsedRegistryUrl = this.parseRegistryUrl(registryUrl);

    return withCache(
      {
        namespace: `datasource-${RpmDatasource.id}`,
        key: parsedRegistryUrl.registryUrl,
        ttlMinutes: 1440,
      },
      () => fetchPrimaryGzipUrl(this.http, parsedRegistryUrl.registryUrl),
    );
  }

  getReleasesByPackageName(
    primaryGzipUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    return this.providers.primary.getReleases(primaryGzipUrl, packageName);
  }

  private getMetadataUrlOrThrow(
    metadata: RpmRepositoryMetadata,
    metadataType: RpmMetadataSource,
  ): string {
    const metadataUrl =
      metadataType === 'primary'
        ? metadata.primaryGzipUrl
        : metadata.primaryDbUrl;

    if (!metadataUrl) {
      throw new Error(`No ${metadataType} data found in ${metadata.repomdUrl}`);
    }

    return metadataUrl;
  }
}
