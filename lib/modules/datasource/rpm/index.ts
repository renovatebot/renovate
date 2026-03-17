import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { RpmXmlMetadataProvider } from './providers/xml.ts';

export class RpmDatasource extends Datasource {
  static readonly id = 'rpm';

  // repomd.xml is a standard file name in RPM repositories which contains metadata about the repository
  static readonly repomdXmlFileName = 'repomd.xml';

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

  private getPrimaryRepodataUrl(
    xml: XmlDocument,
    registryUrl: string,
    repomdUrl: string,
  ): string {
    const primaryData = xml.childWithAttribute('type', 'primary');

    if (!primaryData) {
      throw new Error(`No primary data found in ${repomdUrl}`);
    }

    const locationElement = primaryData.childNamed('location');
    if (!locationElement) {
      throw new Error(`No location element found in ${repomdUrl}`);
    }

    const href = locationElement.attr.href;
    if (!href) {
      throw new Error(`No href found in ${repomdUrl}`);
    }

    // replace trailing "repodata/" from registryUrl, if it exists, with a "/" because href includes "repodata/"
    const registryUrlWithoutRepodata = registryUrl.replace(
      /\/repodata\/?$/,
      '/',
    );

    return joinUrlParts(registryUrlWithoutRepodata, href);
  }

  private async _getPrimaryGzipUrl(registryUrl: string): Promise<string> {
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

    try {
      return this.getPrimaryRepodataUrl(xml, registryUrl, repomdUrl.toString());
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.startsWith('No primary data found')
      ) {
        logger.debug(
          `No primary data found in ${repomdUrl}, xml contents: ${response.body}`,
        );
      }

      throw err;
    }
  }

  getPrimaryGzipUrl(registryUrl: string): Promise<string> {
    return withCache(
      {
        namespace: `datasource-${RpmDatasource.id}`,
        key: registryUrl,
        ttlMinutes: 1440,
      },
      () => this._getPrimaryGzipUrl(registryUrl),
    );
  }

  async getReleasesByPackageName(
    primaryGzipUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    return await this.xmlProvider.getReleases(primaryGzipUrl, packageName);
  }
}
