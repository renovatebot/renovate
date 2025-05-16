import { DOMParser } from '@xmldom/xmldom';
import { r } from 'tar';
import { code } from 'tar/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export class RpmDatasource extends Datasource {
  static readonly id = 'rpm';

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
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl) {
      return null;
    }
    // add a trailing slash if it doesn't exist
    const normalizedRegistryUrl = registryUrl.endsWith('/')
      ? registryUrl
      : `${registryUrl}/`;
    const filelistsXmlUrl = await this.getFilelistsXmlUrl(
      normalizedRegistryUrl,
    );
    if (!filelistsXmlUrl) {
      return null;
    }

    const release = await this.getReleasesByPackageName(
      filelistsXmlUrl,
      packageName,
    );

    return release;
  }

  async getFilelistsXmlUrl(registryUrl: string): Promise<string> {
    // check if registryUrl/repomd.xml exists
    const repomdUrl = new URL('repomd.xml', registryUrl);
    const response = await this.http.getText(repomdUrl.toString());
    if (response.statusCode !== 200) {
      throw new Error(
        `Failed to fetch repomd.xml from ${repomdUrl} (${response.statusCode})`,
      );
    }
    if (!response.body) {
      throw new Error(`Failed to fetch repomd.xml from ${repomdUrl}`);
    }
    // parse repomd.xml
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.body, 'text/xml');
    const dataElements = xmlDoc.getElementsByTagName('data');
    for (const dataElement of dataElements) {
      if (dataElement.getAttribute('type') === 'filelists') {
        const locationElement = dataElement.getElementsByTagName('location')[0];
        if (!locationElement) {
          throw new Error(`No location element found in filelists.xml`);
        }
        const href = locationElement.getAttribute('href');
        if (!href) {
          throw new Error(`No href found in filelists.xml`);
        }
        // replace trailing "repodata/" from registryUrl, if it exists, with a "/" because href includes "repodata/"
        const registryUrlWithoutRepodata = registryUrl.replace(
          /\/repodata\/?$/,
          '/',
        );
        return new URL(href, registryUrlWithoutRepodata).toString();
      }
    }
    throw new Error(`No filelists found in repomd.xml`);
  }

  async getReleasesByPackageName(
    filelistsXmlUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    try {
      const response = await this.http.getText(filelistsXmlUrl);
      if (response.statusCode !== 200) {
        throw new Error(
          `Failed to fetch filelists.xml from ${filelistsXmlUrl} (${response.statusCode})`,
        );
      }
      if (!response.body) {
        throw new Error(
          `Failed to fetch filelists.xml from ${filelistsXmlUrl}`,
        );
      }
      // parse filelists.xml
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response.body, 'text/xml');
      const filelists = xmlDoc.getElementsByTagName('filelists')[0];
      if (!filelists) {
        throw new Error(`No filelists found in filelists.xml`);
      }
      const packages = filelists.getElementsByTagName('package');
      if (!packages) {
        throw new Error(`No packages found in filelists.xml`);
      }
      const releases: Release[] = [];
      for (const pkg of packages) {
        const name = pkg.getAttribute('name');
        if (!name) {
          throw new Error(`No name found in package`);
        }
        if (name !== packageName) {
          continue;
        }
        const version = pkg.getAttribute('version');
        if (!version) {
          throw new Error(`No version found in package`);
        }

        // check if the version isn't already in the releases
        // One version could have multiple revisions or releases
        // e.g. 1.0.0-1, 1.0.0-2, 1.0.0-3
        // Here we only keep the version part
        const existingRelease = releases.find(
          (release) => release.version === version,
        );
        if (!existingRelease) {
          releases.push({
            version,
          });
        }
      }
      if (releases.length === 0) {
        return null;
      }
      return {
        releases,
      };
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }
}
