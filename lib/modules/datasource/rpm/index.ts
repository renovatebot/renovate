import { Readable } from 'node:stream';
import { gunzip } from 'node:zlib';
import { promisify } from 'util';
import * as expat from 'node-expat';
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
    key: (registryUrl: string) => registryUrl,
    ttlMinutes: 1440,
  })
  async getFilelistsGzipUrl(registryUrl: string): Promise<string | null> {
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

    const filelistsData = xml.childWithAttribute('type', 'filelists');

    if (!filelistsData) {
      logger.debug(
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
    let response: HttpResponse<Buffer>;
    let decompressedBuffer: Buffer;
    try {
      // filelistsXmlUrl is a .gz file, need to extract it before parsing
      response = await this.http.getBuffer(filelistsGzipUrl);
      if (response.body.length === 0) {
        logger.debug(`Empty response body from getting ${filelistsGzipUrl}.`);
        throw new Error(
          `Empty response body from getting ${filelistsGzipUrl}.`,
        );
      }
      // decompress the gzipped file
      decompressedBuffer = await gunzipAsync(response.body);
    } catch (err) {
      logger.debug(
        `Failed to fetch or decompress ${filelistsGzipUrl}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      throw err;
    }

    // Use XML streaming parser to handle large XML files efficiently
    // If the file is too large (e.g., > 512MB), node.js doesn't support it natively.
    // Therefore, we use a streaming parser to handle the XML file.
    // This allows us to parse the XML file without loading the entire file into memory.
    const releases: Record<string, Release> = {};
    let foundAny = false;
    let insideTargetPackage = false;
    let versionAttrs: { ver?: string; rel?: string } = {};

    // Wrap parsing in a Promise for proper async handling
    await new Promise<void>((resolve, reject) => {
      const xmlStream = Readable.from(decompressedBuffer);
      const parser = new expat.Parser('UTF-8');

      parser.on('startElement', (name: string, attrs: any) => {
        if (name === 'package') {
          insideTargetPackage = attrs.name === packageName;
          versionAttrs = {};
        } else if (insideTargetPackage && name === 'version') {
          versionAttrs = attrs;
        }
      });

      parser.on('endElement', (tagName: string) => {
        if (tagName === 'package') {
          if (insideTargetPackage && versionAttrs.ver) {
            let versionWithRel = versionAttrs.ver ?? '';
            if (versionAttrs.rel ?? false) {
              versionWithRel += `-${versionAttrs.rel}`;
            }
            if (!releases[versionWithRel]) {
              releases[versionWithRel] = { version: versionWithRel };
              foundAny = true;
            }
          }
          insideTargetPackage = false;
          versionAttrs = {};
        }
      });

      parser.on('error', (err: Error) => {
        parser.removeAllListeners();
        xmlStream.destroy();
        logger.debug(
          `XmlStream parsing error in ${filelistsGzipUrl}: ${err.message}`,
        );
        reject(err);
      });

      xmlStream.on('data', (chunk) => {
        parser.write(chunk);
      });
      xmlStream.on('end', () => {
        parser.removeAllListeners();
        resolve();
      });
      xmlStream.on('error', (err) => {
        parser.removeAllListeners();
        reject(err);
      });
    });

    if (!foundAny) {
      logger.trace(
        `No releases found for package ${packageName} in ${filelistsGzipUrl}`,
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
