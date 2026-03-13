import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { RpmSqliteMetadataProvider } from './providers/sqlite.ts';
import { RpmXmlMetadataProvider } from './providers/xml.ts';

interface RpmRepositoryMetadata {
  repomdUrl: string;
  primaryDbUrl?: string;
  primaryGzipUrl?: string;
}

type ResolvedRpmMetadataSource = 'auto' | 'primary' | 'primary_db';

export class RpmDatasource extends Datasource {
  static readonly id = 'rpm';

  // repomd.xml is a standard file name in RPM repositories which contains metadata about the repository
  static readonly repomdXmlFileName = 'repomd.xml';

  private readonly sqliteProvider: RpmSqliteMetadataProvider;
  private readonly xmlProvider: RpmXmlMetadataProvider;

  constructor() {
    super(RpmDatasource.id);
    this.sqliteProvider = new RpmSqliteMetadataProvider(this.http);
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
    rpmMetadataSource,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl || !packageName) {
      return null;
    }

    try {
      const metadata = await this.getRepositoryMetadata(registryUrl);
      const metadataSource = this.resolveMetadataSource(rpmMetadataSource);

      if (metadataSource === 'primary') {
        return await this.getPrimaryReleases(metadata, packageName);
      }

      if (metadataSource === 'primary_db') {
        return await this.getPrimaryDbReleases(metadata, packageName);
      }

      const { primaryDbUrl, primaryGzipUrl } = metadata;
      let sqliteError: Error | undefined;

      if (primaryDbUrl) {
        try {
          return await this.getPrimaryDbReleases(metadata, packageName);
        } catch (err) {
          sqliteError = err as Error;
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
        return await this.getPrimaryReleases(metadata, packageName);
      }

      if (sqliteError) {
        throw sqliteError;
      }

      return null;
    } catch (err) {
      this.handleGenericErrors(err as Error);
    }
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const metadataSource = this.resolveMetadataSource(config.rpmMetadataSource);

    return withCache(
      {
        namespace: `datasource-${RpmDatasource.id}`,
        key: `${config.registryUrl}:${config.packageName}:${metadataSource}`,
        ttlMinutes: 1440,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private resolveMetadataSource(
    rpmMetadataSource?: GetReleasesConfig['rpmMetadataSource'],
  ): ResolvedRpmMetadataSource {
    if (rpmMetadataSource === 'primary' || rpmMetadataSource === 'primary_db') {
      return rpmMetadataSource;
    }

    return 'auto';
  }

  private async getPrimaryDbReleases(
    metadata: RpmRepositoryMetadata,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    if (!metadata.primaryDbUrl) {
      throw new Error(`No primary_db data found in ${metadata.repomdUrl}`);
    }

    return await this.sqliteProvider.getReleases(
      metadata.primaryDbUrl,
      packageName,
    );
  }

  private async getPrimaryReleases(
    metadata: RpmRepositoryMetadata,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    if (!metadata.primaryGzipUrl) {
      throw new Error(`No primary data found in ${metadata.repomdUrl}`);
    }

    return await this.xmlProvider.getReleases(
      metadata.primaryGzipUrl,
      packageName,
    );
  }

  private getRepodataUrl(
    xml: XmlDocument,
    registryUrl: string,
    repomdUrl: string,
    type: 'primary' | 'primary_db',
    optional = false,
  ): string | undefined {
    const data = xml.childWithAttribute('type', type);

    if (!data) {
      return undefined;
    }

    const locationElement = data.childNamed('location');
    if (!locationElement) {
      if (optional) {
        logger.debug(
          { datasource: RpmDatasource.id, repomdUrl, type },
          'Optional repomd entry does not contain a location element',
        );
        return undefined;
      }

      throw new Error(`No location element found in ${repomdUrl}`);
    }

    const href = locationElement.attr.href;
    if (!href) {
      if (optional) {
        logger.debug(
          { datasource: RpmDatasource.id, repomdUrl, type },
          'Optional repomd entry does not contain an href attribute',
        );
        return undefined;
      }

      throw new Error(`No href found in ${repomdUrl}`);
    }

    // replace trailing "repodata/" from registryUrl, if it exists, with a "/" because href includes "repodata/"
    const registryUrlWithoutRepodata = registryUrl.replace(
      /\/repodata\/?$/,
      '/',
    );

    return joinUrlParts(registryUrlWithoutRepodata, href);
  }

  private async _getRepositoryMetadata(
    registryUrl: string,
  ): Promise<RpmRepositoryMetadata> {
    const repomdUrl = joinUrlParts(
      registryUrl,
      RpmDatasource.repomdXmlFileName,
    );
    const response = await this.http.getText(repomdUrl.toString());

    const repomdBody = response.body.trimStart();

    // repomd.xml may omit the XML declaration and start directly with the root element
    if (!(repomdBody.startsWith('<?xml') || repomdBody.startsWith('<repomd'))) {
      logger.debug(
        { datasource: RpmDatasource.id, url: repomdUrl },
        'Invalid response format',
      );
      throw new Error(
        `${repomdUrl} is not in XML format. Response body: ${response.body}`,
      );
    }

    const xml = new XmlDocument(repomdBody);
    const primaryGzipUrl = this.getRepodataUrl(
      xml,
      registryUrl,
      repomdUrl.toString(),
      'primary',
    );
    const primaryDbUrl = this.getRepodataUrl(
      xml,
      registryUrl,
      repomdUrl.toString(),
      'primary_db',
      true,
    );

    if (!primaryGzipUrl && !primaryDbUrl) {
      logger.debug(
        `No primary data found in ${repomdUrl}, xml contents: ${response.body}`,
      );
      throw new Error(`No primary data found in ${repomdUrl}`);
    }

    return {
      primaryDbUrl,
      primaryGzipUrl,
      repomdUrl: repomdUrl.toString(),
    };
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
      () => this._getRepositoryMetadata(registryUrl),
    );
  }

  async getPrimaryGzipUrl(registryUrl: string): Promise<string> {
    const metadata = await this.getRepositoryMetadata(registryUrl);

    if (!metadata.primaryGzipUrl) {
      throw new Error(`No primary data found in ${metadata.repomdUrl}`);
    }

    return metadata.primaryGzipUrl;
  }

  async getReleasesByPackageName(
    primaryGzipUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    return await this.xmlProvider.getReleases(primaryGzipUrl, packageName);
  }
}
