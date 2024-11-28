import is from '@sindresorhus/is';
import type { XmlDocument } from 'xmldoc';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import { cache } from '../../../util/cache/package/decorator';
import { ensureTrailingSlash } from '../../../util/url';
import mavenVersion from '../../versioning/maven';
import * as mavenVersioning from '../../versioning/maven';
import { compare } from '../../versioning/maven/compare';
import { Datasource } from '../datasource';
import type {
  GetReleasesConfig,
  PostprocessReleaseConfig,
  PostprocessReleaseResult,
  RegistryStrategy,
  Release,
  ReleaseResult,
} from '../types';
import { MAVEN_REPO } from './common';
import type { MavenDependency } from './types';
import {
  checkResource,
  createUrlForDependencyPom,
  downloadMavenXml,
  getDependencyInfo,
  getDependencyParts,
  getMavenUrl,
} from './util';

function getLatestSuitableVersion(releases: Release[]): string | null {
  // istanbul ignore if
  if (!releases?.length) {
    return null;
  }
  const allVersions = releases.map(({ version }) => version);
  const stableVersions = allVersions.filter((x) => mavenVersion.isStable(x));
  const versions = stableVersions.length ? stableVersions : allVersions;
  return versions.reduce((latestVersion, version) =>
    compare(version, latestVersion) === 1
      ? version
      : /* istanbul ignore next: hard to test */ latestVersion,
  );
}

function extractVersions(metadata: XmlDocument): string[] {
  const versions = metadata.descendantWithPath('versioning.versions');
  const elements = versions?.childrenNamed('version');
  if (!elements) {
    return [];
  }
  return elements.map((el) => el.val);
}

export const defaultRegistryUrls = [MAVEN_REPO];

export class MavenDatasource extends Datasource {
  static id = 'maven';

  override readonly caching = true;

  override readonly defaultRegistryUrls = defaultRegistryUrls;

  override readonly defaultVersioning: string = mavenVersioning.id;

  override readonly registryStrategy: RegistryStrategy = 'merge';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `Last-Modified` header or the `lastModified` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `scm` tags in the results.';

  constructor(id = MavenDatasource.id) {
    super(id);
  }

  async fetchVersionsFromMetadata(
    dependency: MavenDependency,
    repoUrl: string,
  ): Promise<string[]> {
    const metadataUrl = getMavenUrl(dependency, repoUrl, 'maven-metadata.xml');

    const cacheNamespace = 'datasource-maven:metadata-xml';
    const cacheKey = `v2:${metadataUrl}`;
    const cachedVersions = await packageCache.get<string[]>(
      cacheNamespace,
      cacheKey,
    );
    /* istanbul ignore if */
    if (cachedVersions) {
      return cachedVersions;
    }

    const { isCacheable, xml: mavenMetadata } = await downloadMavenXml(
      this.http,
      metadataUrl,
    );
    if (!mavenMetadata) {
      return [];
    }

    const versions = extractVersions(mavenMetadata);
    const cachePrivatePackages = GlobalConfig.get(
      'cachePrivatePackages',
      false,
    );
    if (cachePrivatePackages || isCacheable) {
      await packageCache.set(cacheNamespace, cacheKey, versions, 30);
    }

    return versions;
  }

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const dependency = getDependencyParts(packageName);
    const repoUrl = ensureTrailingSlash(registryUrl);

    logger.debug(`Looking up ${dependency.display} in repository ${repoUrl}`);

    const metadataVersions = await this.fetchVersionsFromMetadata(
      dependency,
      repoUrl,
    );
    if (!metadataVersions?.length) {
      return null;
    }
    const releases = metadataVersions.map((version) => ({ version }));

    logger.debug(
      `Found ${releases.length} new releases for ${dependency.display} in repository ${repoUrl}`,
    );

    const latestSuitableVersion = getLatestSuitableVersion(releases);
    const dependencyInfo =
      latestSuitableVersion &&
      (await getDependencyInfo(
        this.http,
        dependency,
        repoUrl,
        latestSuitableVersion,
      ));

    const result: ReleaseResult = {
      ...dependency,
      ...dependencyInfo,
      releases,
    };

    if (!this.defaultRegistryUrls.includes(registryUrl)) {
      result.isPrivate = true;
    }

    return result;
  }

  @cache({
    namespace: `datasource-maven`,
    key: (
      { registryUrl, packageName }: PostprocessReleaseConfig,
      { version, versionOrig }: Release,
    ) =>
      `postprocessRelease:${registryUrl}:${packageName}:${versionOrig ? `${versionOrig}:${version}` : `${version}`}`,
    ttlMinutes: 24 * 60,
  })
  override async postprocessRelease(
    { packageName, registryUrl }: PostprocessReleaseConfig,
    release: Release,
  ): Promise<PostprocessReleaseResult> {
    if (!packageName || !registryUrl) {
      return release;
    }

    const dependency = getDependencyParts(packageName);

    const pomUrl = await createUrlForDependencyPom(
      this.http,
      release.versionOrig ?? release.version,
      dependency,
      registryUrl,
    );

    const artifactUrl = getMavenUrl(dependency, registryUrl, pomUrl);

    const res = await checkResource(this.http, artifactUrl);

    if (res === 'not-found' || res === 'error') {
      return 'reject';
    }

    if (is.date(res)) {
      release.releaseTimestamp = res.toISOString();
    }

    return release;
  }
}
