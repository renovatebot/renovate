import { XmlDocument } from 'xmldoc';
import { cache } from '../../../util/cache/package/decorator';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

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
      const filelistsXmlUrl = await this.getFilelistsXmlUrl(
        ensureTrailingSlash(registryUrl),
      );
      if (!filelistsXmlUrl) {
        return null;
      }
      const release = await this.getReleasesByPackageName(
        filelistsXmlUrl,
        packageName,
      );

      return release;
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  @cache({
    namespace: `datasource-${RpmDatasource.id}`,
    key: ({ registryUrl }: GetReleasesConfig) => registryUrl ?? '',
    ttlMinutes: 1440,
  })
  async getFilelistsXmlUrl(registryUrl: string): Promise<string | null> {
    const repomdUrl = joinUrlParts(
      registryUrl,
      RpmDatasource.repomdXmlFileName,
    );
    const response = await this.http.getText(repomdUrl.toString());
    if (response.statusCode !== 200) {
      throw new Error(
        `Failed to fetch repomd.xml from ${repomdUrl} (${response.statusCode})`,
      );
    }

    // parse repomd.xml using XmlDocument
    const data = new XmlDocument(response.body);
    const dataElements = data.childrenNamed('data');

    for (const dataElement of dataElements) {
      if (dataElement.attr.type === 'filelists') {
        const locationElement = dataElement.childNamed('location');
        if (!locationElement) {
          throw new Error(`No location element found in filelists.xml`);
        }
        const href = locationElement.attr.href;
        if (!href) {
          throw new Error(`No href found in filelists.xml`);
        }
        // replace trailing "repodata/" from registryUrl, if it exists, with a "/" because href includes "repodata/"
        const registryUrlWithoutRepodata = registryUrl.replace(
          /\/repodata\/?$/,
          '/',
        );
        return joinUrlParts(registryUrlWithoutRepodata, href);
      }
    }

    return null;
  }

  async getReleasesByPackageName(
    filelistsXmlUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    const response = await this.http.getText(filelistsXmlUrl);
    if (response.statusCode !== 200) {
      throw new Error(
        `Failed to fetch filelists.xml from ${filelistsXmlUrl} (${response.statusCode})`,
      );
    }
    // parse filelists.xml
    const data = new XmlDocument(response.body);
    const packages = data.childrenNamed('package');
    if (!packages) {
      throw new Error(`No packages found in filelists.xml`);
    }
    const releases: Release[] = [];
    for (const pkg of packages) {
      const name = pkg.attr.name;
      if (name !== packageName) {
        continue;
      }
      const version = pkg.childNamed('version')?.attr?.ver ?? '';
      const rel = pkg.childNamed('version')?.attr?.rel;
      let versionWithRel = version;
      if (rel) {
        // if rel is present, we need to append it to the version. Otherwise, ignore it.
        // e.g. 1.0.0-1, 1.0.0-2, 1.0.0-3 or 1.0.0
        versionWithRel += `-${rel}`;
      }

      // check if the versionWithRel isn't already in the releases
      // One versionWithRel could have multiple revisions or releases
      // e.g. 1.0.0-1, 1.0.0-2, 1.0.0-3
      const existingRelease = releases.find(
        (release) => release.version === versionWithRel,
      );
      if (!existingRelease) {
        releases.push({
          version: versionWithRel,
        });
      }
    }
    if (releases.length === 0) {
      return null;
    }
    return {
      releases,
    };
  }
}
