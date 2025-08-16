import { Readable } from 'node:stream';
import { gunzip } from 'node:zlib';
import { promisify } from 'util';
import sax from 'sax';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpResponse } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
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
   * There is a URI http://linux.duke.edu/metadata/common in the <sha>-primary.xml.
   * But according to this post, it's not something we can really look into or reference.
   * @see{https://lists.rpm.org/pipermail/rpm-ecosystem/2015-October/000283.html}
   */
  override readonly customRegistrySupport = true;

  /**
   * Fetches the release information for a given package from the registry URL.
   *
   * @param registryUrl - the registryUrl should be the folder which contains repodata.xml and its corresponding file list <sha256>-primary.xml.gz, e.g.: https://packages.microsoft.com/azurelinux/3.0/prod/cloud-native/x86_64/repodata/
   * @param packageName - the name of the package to fetch releases for.
   * @returns The release result if the package is found, otherwise null.
   */
  @cache({
    namespace: `datasource-${RpmDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl}:${packageName}`,
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
      const primaryGzipUrl = await this.getPrimaryGzipUrl(registryUrl);
      if (!primaryGzipUrl) {
        return null;
      }
      return await this.getReleasesByPackageName(primaryGzipUrl, packageName);
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  // Fetches the primary.xml.gz URL from the repomd.xml file.
  @cache({
    namespace: `datasource-${RpmDatasource.id}`,
    key: (registryUrl: string) => registryUrl,
    ttlMinutes: 1440,
  })
  async getPrimaryGzipUrl(registryUrl: string): Promise<string | null> {
    const repomdUrl = joinUrlParts(
      registryUrl,
      RpmDatasource.repomdXmlFileName,
    );
    const response = await this.http.getText(repomdUrl.toString());

    // check if repomd.xml is in XML format
    if (!response.body.startsWith('<?xml')) {
      logger.debug(
        { datasource: RpmDatasource.id, url: repomdUrl },
        'Invalid response format',
      );
      throw new Error(
        `${repomdUrl} is not in XML format. Response body: ${response.body}`,
      );
    }

    // parse repomd.xml using XmlDocument
    const xml = new XmlDocument(response.body);

    const primaryData = xml.childWithAttribute('type', 'primary');

    if (!primaryData) {
      logger.debug(
        `No primary data found in ${repomdUrl}, xml contents: ${response.body}`,
      );
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

  async getReleasesByPackageName(
    primaryGzipUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    let response: HttpResponse<Buffer>;
    let decompressedBuffer: Buffer;
    try {
      // primaryGzipUrl is a .gz file, need to extract it before parsing
      response = await this.http.getBuffer(primaryGzipUrl);
      if (response.body.length === 0) {
        logger.debug(`Empty response body from getting ${primaryGzipUrl}.`);
        throw new Error(`Empty response body from getting ${primaryGzipUrl}.`);
      }
      // decompress the gzipped file
      decompressedBuffer = await gunzipAsync(response.body);
    } catch (err) {
      logger.debug(
        `Failed to fetch or decompress ${primaryGzipUrl}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      throw err;
    }

    // Use sax streaming parser to handle large XML files efficiently
    // This allows us to parse the XML file without loading the entire file into memory.
    const releases: Record<string, Release> = {};
    let insidePackage = false;
    let isTargetPackage = false;
    let insideName = false;

    // Create a SAX parser in strict mode
    const saxParser = sax.createStream(true, {
      lowercase: true, // normalize tag names to lowercase
      trim: true,
    });

    saxParser.on('opentag', (node: sax.Tag) => {
      if (node.name === 'package' && node.attributes.type === 'rpm') {
        insidePackage = true;
        isTargetPackage = false;
      }
      if (insidePackage && node.name === 'name') {
        insideName = true;
      }
      if (insidePackage && isTargetPackage && node.name === 'version') {
        // rel is optional
        if (node.attributes.rel === undefined) {
          const version = `${node.attributes.ver}`;
          releases[version] = { version };
        } else {
          const version = `${node.attributes.ver}-${node.attributes.rel}`;
          releases[version] = { version };
        }
      }
    });
    saxParser.on('text', (text: string) => {
      if (insidePackage && insideName) {
        if (text.trim() === packageName) {
          isTargetPackage = true;
        }
      }
    });
    saxParser.on('closetag', (tag: string) => {
      if (tag === 'name' && insidePackage) {
        insideName = false;
      }
      if (tag === 'package') {
        insidePackage = false;
        isTargetPackage = false;
      }
    });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      saxParser.on('error', (err: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        logger.debug(`SAX parsing error in ${primaryGzipUrl}: ${err.message}`);
        setImmediate(() => saxParser.removeAllListeners());
        reject(err);
      });
      saxParser.on('end', () => {
        settled = true;
        setImmediate(() => saxParser.removeAllListeners());
        resolve();
      });
      Readable.from(decompressedBuffer).pipe(saxParser);
    });

    if (Object.keys(releases).length === 0) {
      logger.trace(
        `No releases found for package ${packageName} in ${primaryGzipUrl}`,
      );
      return null;
    }
    return {
      releases: Object.values(releases).map((release) => ({
        version: release.version,
      })),
    };
  }
}
