import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import type { XmlDocument } from 'xmldoc';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import { cache } from '../../../util/cache/package/decorator';
import { newlineRegex, regEx } from '../../../util/regex';
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
import type { MavenDependency, ReleaseMap } from './types';
import {
  checkResource,
  createUrlForDependencyPom,
  downloadHttpProtocol,
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

const mavenCentralHtmlVersionRegex = regEx(
  '^<a href="(?<version>[^"]+)/" title="(?:[^"]+)/">(?:[^"]+)/</a>\\s+(?<releaseTimestamp>\\d\\d\\d\\d-\\d\\d-\\d\\d \\d\\d:\\d\\d)\\s+-$',
  'i',
);

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

  async fetchReleasesFromMetadata(
    dependency: MavenDependency,
    repoUrl: string,
  ): Promise<ReleaseMap> {
    const metadataUrl = getMavenUrl(dependency, repoUrl, 'maven-metadata.xml');

    const cacheNamespace = 'datasource-maven:metadata-xml';
    const cacheKey = metadataUrl.toString();
    const cachedVersions = await packageCache.get<ReleaseMap>(
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
      return {};
    }

    const versions = extractVersions(mavenMetadata);
    const releaseMap = versions.reduce(
      (acc, version) => ({ ...acc, [version]: null }),
      {},
    );
    const cachePrivatePackages = GlobalConfig.get(
      'cachePrivatePackages',
      false,
    );
    if (cachePrivatePackages || isCacheable) {
      await packageCache.set(cacheNamespace, cacheKey, releaseMap, 30);
    }
    return releaseMap;
  }

  async addReleasesFromIndexPage(
    inputReleaseMap: ReleaseMap,
    dependency: MavenDependency,
    repoUrl: string,
  ): Promise<ReleaseMap> {
    if (!repoUrl.startsWith(MAVEN_REPO)) {
      return inputReleaseMap;
    }

    const cacheNs = 'datasource-maven:index-html-releases';
    const cacheKey = `${repoUrl}${dependency.dependencyUrl}`;
    let workingReleaseMap = await packageCache.get<ReleaseMap>(
      cacheNs,
      cacheKey,
    );
    if (!workingReleaseMap) {
      workingReleaseMap = {};
      let retryEarlier = false;
      try {
        const indexUrl = getMavenUrl(dependency, repoUrl, '');
        const res = await downloadHttpProtocol(this.http, indexUrl);
        if (res) {
          for (const line of res.body.split(newlineRegex)) {
            const match = line.trim().match(mavenCentralHtmlVersionRegex);
            if (match) {
              const { version, releaseTimestamp: timestamp } =
                match?.groups ?? /* istanbul ignore next: hard to test */ {};
              if (version && timestamp) {
                const date = DateTime.fromFormat(
                  timestamp,
                  'yyyy-MM-dd HH:mm',
                  {
                    zone: 'UTC',
                  },
                );
                if (date.isValid) {
                  const releaseTimestamp = date.toISO();
                  workingReleaseMap[version] = { version, releaseTimestamp };
                }
              }
            }
          }
        }
      } catch (err) /* istanbul ignore next */ {
        retryEarlier = true;
        logger.debug(
          { dependency, err },
          'Failed to get releases from package index page',
        );
      }
      const cacheTTL = retryEarlier
        ? /* istanbul ignore next: hard to test */ 60
        : 24 * 60;
      await packageCache.set(cacheNs, cacheKey, workingReleaseMap, cacheTTL);
    }

    const releaseMap = { ...inputReleaseMap };
    for (const version of Object.keys(releaseMap)) {
      releaseMap[version] ||= workingReleaseMap[version] ?? null;
    }

    return releaseMap;
  }

  getReleasesFromMap(releaseMap: ReleaseMap): Release[] {
    const releases = Object.values(releaseMap).filter(is.truthy);
    if (releases.length) {
      return releases;
    }
    return Object.keys(releaseMap).map((version) => ({ version }));
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

    let releaseMap = await this.fetchReleasesFromMetadata(dependency, repoUrl);
    releaseMap = await this.addReleasesFromIndexPage(
      releaseMap,
      dependency,
      repoUrl,
    );
    const releases = this.getReleasesFromMap(releaseMap);
    if (!releases?.length) {
      return null;
    }

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
      `postprocessRelease:${registryUrl}:${packageName}:${versionOrig ?? version}`,
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
