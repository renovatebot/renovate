import upath from 'upath';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import { cache } from '../../../util/cache/package/decorator';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import type { Timestamp } from '../../../util/timestamp';
import { asTimestamp } from '../../../util/timestamp';
import { ensureTrailingSlash, trimTrailingSlash } from '../../../util/url';
import * as ivyVersioning from '../../versioning/ivy';
import { compare } from '../../versioning/maven/compare';
import { MavenDatasource } from '../maven';
import { MAVEN_REPO } from '../maven/common';
import { downloadHttpContent, downloadHttpProtocol } from '../maven/util';
import type {
  GetReleasesConfig,
  PostprocessReleaseConfig,
  PostprocessReleaseResult,
  RegistryStrategy,
  Release,
  ReleaseResult,
} from '../types';
import { extractPageLinks, getLatestVersion } from './util';

interface ScalaDepCoordinate {
  groupId: string;
  artifactId: string;
  scalaVersion?: string;
}

interface PomInfo {
  homepage?: string;
  sourceUrl?: string;
  releaseTimestamp?: Timestamp;
}

export class SbtPackageDatasource extends MavenDatasource {
  static override readonly id = 'sbt-package';

  override readonly defaultRegistryUrls = [MAVEN_REPO];

  override readonly defaultVersioning = ivyVersioning.id;

  override readonly registryStrategy: RegistryStrategy = 'hunt';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `scm` tags in the results.';

  constructor(id = SbtPackageDatasource.id) {
    super(id);
    this.http = new Http('sbt');
  }

  protected static parseDepCoordinate(packageName: string): ScalaDepCoordinate {
    const [groupId, javaArtifactId] = packageName.split(':');
    const [artifactId, scalaVersion] = javaArtifactId.split('_');
    return { groupId, artifactId, scalaVersion };
  }

  async getSbtReleases(
    registryUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    const { groupId, artifactId, scalaVersion } =
      SbtPackageDatasource.parseDepCoordinate(packageName);

    const groupIdSplit = groupId.split('.');
    const repoRootUrl = ensureTrailingSlash(registryUrl);

    const validRootUrlKey = `valid-root-url:${registryUrl}:${packageName}`;
    const validRootUrl = await packageCache.get<string>(
      'datasource-sbt-package',
      validRootUrlKey,
    );

    const packageRootUrls: string[] = [];
    // istanbul ignore if: not easily testable
    if (validRootUrl) {
      packageRootUrls.push(validRootUrl);
    } else {
      const packageRootUrlWith = (sep: string): string =>
        `${repoRootUrl}${groupIdSplit.join(sep)}`;
      packageRootUrls.push(ensureTrailingSlash(packageRootUrlWith('/')));
      packageRootUrls.push(ensureTrailingSlash(packageRootUrlWith('.')));
    }

    let dependencyUrl: string | undefined;
    let packageUrls: string[] | undefined;
    for (const packageRootUrl of packageRootUrls) {
      const packageRootContent = await downloadHttpContent(
        this.http,
        packageRootUrl,
      );
      if (!packageRootContent) {
        continue;
      }

      await packageCache.set(
        'datasource-sbt-package',
        validRootUrlKey,
        packageRootUrl,
        30 * 24 * 60,
      );

      dependencyUrl = trimTrailingSlash(packageRootUrl);

      const rootPath = new URL(packageRootUrl).pathname;
      const artifactSubdirs = extractPageLinks(packageRootContent, (href) => {
        const path = href.replace(rootPath, '');

        if (
          path.startsWith(`${artifactId}_native`) ||
          path.startsWith(`${artifactId}_sjs`)
        ) {
          return null;
        }

        if (path === artifactId || path.startsWith(`${artifactId}_`)) {
          return ensureTrailingSlash(`${packageRootUrl}${path}`);
        }

        return null;
      });

      if (scalaVersion) {
        const scalaSubdir = artifactSubdirs.find((x) =>
          x.endsWith(`/${artifactId}_${scalaVersion}/`),
        );
        if (scalaSubdir) {
          packageUrls = [scalaSubdir];
          break;
        }
      }

      packageUrls = artifactSubdirs;
      break;
    }

    if (!packageUrls) {
      return null;
    }

    const invalidPackageUrlsKey = `invalid-package-urls:${registryUrl}:${packageName}`;
    const invalidPackageUrls = new Set(
      await packageCache.get<string[]>(
        'datasource-sbt-package',
        invalidPackageUrlsKey,
      ),
    );
    packageUrls = packageUrls.filter((url) => !invalidPackageUrls.has(url));

    const allVersions = new Set<string>();
    for (const pkgUrl of packageUrls) {
      const packageContent = await downloadHttpContent(this.http, pkgUrl);
      // istanbul ignore if
      if (!packageContent) {
        invalidPackageUrls.add(pkgUrl);
        continue;
      }

      const rootPath = new URL(pkgUrl).pathname;
      const versions = extractPageLinks(packageContent, (href) => {
        const path = href.replace(rootPath, '');
        if (path.startsWith('.')) {
          return null;
        }

        return path;
      });

      for (const version of versions) {
        allVersions.add(version);
      }
    }

    if (invalidPackageUrls.size > 0) {
      await packageCache.set(
        'datasource-sbt-package',
        invalidPackageUrlsKey,
        [...invalidPackageUrls],
        30 * 24 * 60,
      );
    }

    if (packageUrls.length > 0) {
      const packageUrlsKey = `package-urls:${registryUrl}:${packageName}`;
      await packageCache.set(
        'datasource-sbt-package',
        packageUrlsKey,
        packageUrls,
        30 * 24 * 60,
      );
    }

    const versions = [...allVersions];
    if (!versions.length) {
      return null;
    }

    const releases: Release[] = [...allVersions]
      .sort(compare)
      .map((version) => ({ version }));
    const res: ReleaseResult = { releases, dependencyUrl };

    const latestVersion = getLatestVersion(versions);
    const pomInfo = await this.getPomInfo(
      registryUrl,
      packageName,
      latestVersion,
      packageUrls,
    );

    if (pomInfo?.homepage) {
      res.homepage = pomInfo.homepage;
    }

    if (pomInfo?.sourceUrl) {
      res.sourceUrl = pomInfo.sourceUrl;
    }

    return res;
  }

  async getPomInfo(
    registryUrl: string,
    packageName: string,
    version: string | null,
    pkgUrls?: string[],
  ): Promise<PomInfo | null> {
    const packageUrlsKey = `package-urls:${registryUrl}:${packageName}`;
    // istanbul ignore next: will be covered later
    const packageUrls =
      pkgUrls ??
      (await packageCache.get<string[]>(
        'datasource-sbt-package',
        packageUrlsKey,
      ));

    // istanbul ignore if
    if (!packageUrls?.length) {
      return null;
    }

    // istanbul ignore if
    if (!version) {
      return null;
    }

    const invalidPomFilesKey = `invalid-pom-files:${registryUrl}:${packageName}:${version}`;
    const invalidPomFiles = new Set(
      await packageCache.get<string[]>(
        'datasource-sbt-package',
        invalidPomFilesKey,
      ),
    );

    const saveCache = async (): Promise<void> => {
      if (invalidPomFiles.size > 0) {
        await packageCache.set(
          'datasource-sbt-package',
          invalidPomFilesKey,
          [...invalidPomFiles],
          30 * 24 * 60,
        );
      }
    };

    for (const packageUrl of packageUrls) {
      const artifactDir = upath.basename(packageUrl);
      const [artifact] = artifactDir.split('_');

      for (const pomFilePrefix of [artifactDir, artifact]) {
        const pomFileName = `${pomFilePrefix}-${version}.pom`;
        const pomUrl = `${packageUrl}${version}/${pomFileName}`;
        if (invalidPomFiles.has(pomUrl)) {
          continue;
        }

        const res = await downloadHttpProtocol(this.http, pomUrl);
        const { val } = res.unwrap();
        if (!val) {
          invalidPomFiles.add(pomUrl);
          continue;
        }

        const result: PomInfo = {};

        const releaseTimestamp = asTimestamp(val.lastModified);
        if (releaseTimestamp) {
          result.releaseTimestamp = releaseTimestamp;
        }

        const pomXml = new XmlDocument(val.data);

        const homepage = pomXml.valueWithPath('url');
        if (homepage) {
          result.homepage = homepage;
        }

        const sourceUrl = pomXml.valueWithPath('scm.url');
        if (sourceUrl) {
          result.sourceUrl = sourceUrl
            .replace(regEx(/^scm:/), '')
            .replace(regEx(/^git:/), '')
            .replace(regEx(/^git@github.com:/), 'https://github.com/')
            .replace(regEx(/\.git$/), '');
        }

        await saveCache();
        return result;
      }
    }

    await saveCache();
    return null;
  }

  override async getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const { packageName, registryUrl } = config;
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const sbtReleases = await this.getSbtReleases(registryUrl, packageName);
    if (sbtReleases) {
      return sbtReleases;
    }

    logger.debug(
      `Sbt: no versions discovered for ${packageName} listing organization root package folder, fallback to maven datasource for version discovery`,
    );
    const mavenReleaseResult = await super.getReleases(config);
    if (mavenReleaseResult) {
      return mavenReleaseResult;
    }

    logger.debug(`Sbt: no versions found for "${packageName}"`);
    return null;
  }

  @cache({
    namespace: 'datasource-sbt-package',
    key: (
      { registryUrl, packageName }: PostprocessReleaseConfig,
      { version }: Release,
    ) => `postprocessRelease:${registryUrl}:${packageName}:${version}`,
    ttlMinutes: 30 * 24 * 60,
  })
  override async postprocessRelease(
    config: PostprocessReleaseConfig,
    release: Release,
  ): Promise<PostprocessReleaseResult> {
    /* v8 ignore next 3 -- should never happen */
    if (!config.registryUrl) {
      return release;
    }

    const res = await this.getPomInfo(
      config.registryUrl,
      config.packageName,
      release.version,
    );

    if (res?.releaseTimestamp) {
      release.releaseTimestamp = res.releaseTimestamp;
    }

    return release;
  }
}
