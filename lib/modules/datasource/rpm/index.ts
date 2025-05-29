import { gunzip } from 'node:zlib';
import { promisify } from 'util';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
const gunzipAsync = promisify(gunzip);
export class RpmDatasource extends Datasource {
  static readonly id = 'rpm';

  // repomd.xml is a standard file name in RPM repositories which contains metadata about the repository
  static readonly repomdXmlFileName = 'repomd.xml';

  constructor() {
    super(RpmDatasource.id);
  }

  /**
   * Users are able to specify custom RPM repositories as long as they follow the format.
   * There is a URI http://linux.duke.edu/metadata/filelists in the <sha>-filelists.xml.
   * But according to this post, it's not something we can really look into or reference.
   * @see{https://lists.rpm.org/pipermail/rpm-ecosystem/2015-October/000283.html}
   */
  override readonly customRegistrySupport = true;

  /**
   * Fetches the release information for a given package from the registry URL.
   *
   * @param registryUrl - the registryUrl should be the folder which contains repodata.xml and its corresponding file list <sha256>-filelists.xml.gz, e.g.: https://packages.microsoft.com/azurelinux/3.0/prod/cloud-native/x86_64/repodata/
   * @param packageName - the name of the package to fetch releases for.
   * @returns The release result if the package is found, otherwise null.
   */
  @cache({
    namespace: `datasource-${RpmDatasource.id}`,
    key: ({ packageName }: GetReleasesConfig) => packageName,
    ttlMinutes: 1440,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl || !packageName) {
      return null;
    }
    try {
      const filelistsGzipUrl = await this.getFilelistsGzipUrl(registryUrl);
      if (!filelistsGzipUrl) {
        return null;
      }
      return await this.getReleasesByPackageName(filelistsGzipUrl, packageName);
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  // Fetches the filelists.xml.gz URL from the repomd.xml file.
  @cache({
    namespace: `datasource-${RpmDatasource.id}`,
    key: ({ registryUrl }: GetReleasesConfig) =>
      registryUrl ?? '__no_registry_url__',
    ttlMinutes: 1440,
  })
  async getFilelistsGzipUrl(registryUrl: string): Promise<string | null> {
    const repomdUrl = joinUrlParts(
      ensureTrailingSlash(registryUrl),
      RpmDatasource.repomdXmlFileName,
    );
    let response;
    try {
      response = await this.http.getText(repomdUrl.toString());
    } catch (err) {
      logger.warn(
        `Failed to fetch ${repomdUrl}: ${err instanceof Error ? err.message : err}`,
      );
      throw err as Error;
    }

    // check if repomd.xml is in XML format
    if (!response.body.startsWith('<?xml')) {
      logger.warn(
        `${repomdUrl} is not in XML format. Response body: ${response.body}`,
      );
      throw new Error(
        `${repomdUrl} is not in XML format. Response body: ${response.body}`,
      );
    }

    // parse repomd.xml using XmlDocument
    const xml = new XmlDocument(response.body);

    const filelistsData = xml.childWithAttribute('type', 'filelists');

    if (!filelistsData) {
      logger.warn(
        `No filelists data found in ${repomdUrl}, xml contents: ${response.body}`,
      );
      throw new Error(`No filelists data found in ${repomdUrl}`);
    }

    const locationElement = filelistsData.childNamed('location');
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

  async getReleasesByPackageName(
    filelistsGzipUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    let response;
    let decompressedBuffer;
    try {
      // filelistsXmlUrl is a .gz file, need to extract it before parsing
      response = await this.http.getBuffer(filelistsGzipUrl);
      if (response.body.length === 0) {
        logger.warn(`Empty response body from getting ${filelistsGzipUrl}.`);
        throw new Error(
          `Empty response body from getting ${filelistsGzipUrl}.`,
        );
      }
      // decompress the gzipped file
      decompressedBuffer = await gunzipAsync(response.body);
    } catch (err) {
      logger.warn(
        `Failed to fetch or decompress ${filelistsGzipUrl}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      throw err;
    }
    const xmlString = decompressedBuffer.toString('utf8');
    // check if filelistsXmlUrl is in XML format
    if (!(xmlString.startsWith('<?xml') || xmlString.startsWith('\n<?xml'))) {
      logger.warn(
        `Decompressed ${filelistsGzipUrl} is not in XML format. Contents: ${xmlString}`,
      );
      throw new Error(
        `Decompressed ${filelistsGzipUrl} is not in XML format. Contents: ${xmlString}`,
      );
    }

    // parse filelists.xml
    const data = new XmlDocument(xmlString);
    const packages = data.childrenNamed('package');
    if (!packages || packages.length === 0) {
      logger.warn(
        `No packages found in ${filelistsGzipUrl}, xml contents: ${xmlString}`,
      );
      throw new Error(`No packages found in ${filelistsGzipUrl}`);
    }
    const releases = new Map<string, Release>();
    logger.info(`Found ${packages.length} packages in ${filelistsGzipUrl}`);
    for (const pkg of packages) {
      logger.info(
        `Checking package ${pkg.attr.name} for releases in ${filelistsGzipUrl}`,
      );
      const name = pkg.attr.name;
      if (name !== packageName) {
        continue;
      }
      const versionElement = pkg.childNamed('version');
      const version = versionElement?.attr?.ver ?? '';
      if (!version) {
        logger.debug(
          `No version found for package ${name} in ${filelistsGzipUrl}`,
        );
        continue;
      }
      const rel = versionElement?.attr?.rel;
      let versionWithRel = version;
      if (rel) {
        // if rel is present, we need to append it to the version. Otherwise, ignore it.
        // e.g. 1.0.0-1, 1.0.0-2, 1.0.0-3 or 1.0.0
        logger.info(
          `Found version ${version} with rel ${rel} for package ${name}`,
        );
        versionWithRel += `-${rel}`;
      }
      logger.info(
        `Found version ${versionWithRel} for package ${name} in ${filelistsGzipUrl}`,
      );

      // check if the versionWithRel isn't already in the releases
      // One version could have multiple rel
      // (note: this rel is the release/revision key in filelists.xml, not the release data type)
      // e.g. 1.0.0-1, 1.0.0-2, 1.0.0-3
      if (!releases.has(versionWithRel)) {
        releases.set(versionWithRel, {
          version: versionWithRel,
        });
      }
    }
    if (releases.size === 0) {
      logger.warn(
        `No releases found for package ${packageName} in ${filelistsGzipUrl}`,
      );
      return null;
    }
    return {
      releases: Array.from(releases.values()),
    };
  }
}
