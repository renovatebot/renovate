import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { parseUrl } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { datasource } from './common.ts';
import { RpmSqliteMetadataProvider } from './providers/sqlite.ts';
import { RpmXmlMetadataProvider } from './providers/xml.ts';
import type { RpmRepositoryMetadata } from './repomd.ts';
import { fetchRepositoryMetadata } from './repomd.ts';

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
   * @param parsedRegistryUrl - the parsed registry URL and selected metadata source.
   * @param packageName - the name of the package to fetch releases for.
   * @returns The release result if the package is found, otherwise null.
   */
  private async _getReleases(
    parsedRegistryUrl: ParsedRpmRegistryUrl,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    const metadata = await this.getRepositoryMetadata(parsedRegistryUrl);

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
  }

  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { registryUrl, packageName } = config;
    if (!registryUrl || !packageName) {
      return null;
    }

    try {
      const parsedRegistryUrl = this.parseRegistryUrl(registryUrl);

      return await withCache(
        {
          namespace: `datasource-${RpmDatasource.id}`,
          key: `${parsedRegistryUrl.registryUrl}:${packageName}:${parsedRegistryUrl.metadataSource}`,
          ttlMinutes: 1440,
          fallback: true,
        },
        () => this._getReleases(parsedRegistryUrl, packageName),
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }
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

    if (primaryDbUrl) {
      try {
        return await this.getProviderReleases(
          'primary_db',
          metadata,
          packageName,
        );
      } catch (err) {
        if (!primaryGzipUrl) {
          throw err;
        }

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

    return await this.getProviderReleases('primary', metadata, packageName);
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
    parsedRegistryUrl: ParsedRpmRegistryUrl,
  ): Promise<RpmRepositoryMetadata> {
    const { metadataSource, registryUrl } = parsedRegistryUrl;

    return withCache(
      {
        namespace: `datasource-${RpmDatasource.id}`,
        key: `repomd:${registryUrl}:${metadataSource}`,
        ttlMinutes: 1440,
      },
      () => fetchRepositoryMetadata(this.http, registryUrl, metadataSource),
    );
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
