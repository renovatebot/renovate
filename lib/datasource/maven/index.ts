import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import pAll from 'p-all';
import type { XmlDocument } from 'xmldoc';
import { logger } from '../../logger';
import mavenVersion from '../../modules/versioning/maven';
import * as mavenVersioning from '../../modules/versioning/maven';
import { compare } from '../../modules/versioning/maven/compare';
import * as packageCache from '../../util/cache/package';
import { newlineRegex, regEx } from '../../util/regex';
import { ensureTrailingSlash } from '../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { MAVEN_REPO } from './common';
import type { MavenDependency, ReleaseMap } from './types';
import {
  checkHttpResource,
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
    compare(version, latestVersion) === 1 ? version : latestVersion
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
  '^<a href="(?<version>[^"]+)\\/" title="(?:[^"]+)\\/">(?:[^"]+)\\/<\\/a>\\s+(?<releaseTimestamp>\\d\\d\\d\\d-\\d\\d-\\d\\d \\d\\d:\\d\\d)\\s+-$',
  'i'
);

function isSnapshotVersion(version: string): boolean {
  if (version.endsWith('-SNAPSHOT')) {
    return true;
  }
  return false;
}

function extractSnapshotVersion(metadata: XmlDocument): string | null {
  // Parse the maven-metadata.xml for the snapshot version and determine
  // the fixed version of the latest deployed snapshot.
  // The metadata descriptor can be found at
  // https://maven.apache.org/ref/3.3.3/maven-repository-metadata/repository-metadata.html
  //
  // Basically, we need to replace -SNAPSHOT with the artifact timestanp & build number,
  // so for example 1.0.0-SNAPSHOT will become 1.0.0-<timestamp>-<buildNumber>
  const version = metadata
    .descendantWithPath('version')
    ?.val?.replace('-SNAPSHOT', '');

  const snapshot = metadata.descendantWithPath('versioning.snapshot');
  const timestamp = snapshot?.childNamed('timestamp')?.val;
  const build = snapshot?.childNamed('buildNumber')?.val;

  // If we weren't able to parse out the required 3 version elements,
  // return null because we can't determine the fixed version of the latest snapshot.
  if (!version || !timestamp || !build) {
    return null;
  }
  return `${version}-${timestamp}-${build}`;
}

export const defaultRegistryUrls = [MAVEN_REPO];

export class MavenDatasource extends Datasource {
  static id = 'maven';

  override readonly defaultRegistryUrls = defaultRegistryUrls;

  override readonly defaultVersioning = mavenVersioning.id;

  override readonly registryStrategy = 'merge';

  constructor(id = MavenDatasource.id) {
    super(id);
  }

  async fetchReleasesFromMetadata(
    dependency: MavenDependency,
    repoUrl: string
  ): Promise<ReleaseMap> {
    const metadataUrl = getMavenUrl(dependency, repoUrl, 'maven-metadata.xml');

    const cacheNamespace = 'datasource-maven:metadata-xml';
    const cacheKey = metadataUrl.toString();
    const cachedVersions = await packageCache.get<ReleaseMap>(
      cacheNamespace,
      cacheKey
    );
    /* istanbul ignore if */
    if (cachedVersions) {
      return cachedVersions;
    }

    const { authorization, xml: mavenMetadata } = await downloadMavenXml(
      this.http,
      metadataUrl
    );
    if (!mavenMetadata) {
      return {};
    }

    const versions = extractVersions(mavenMetadata);
    const releaseMap = versions.reduce(
      (acc, version) => ({ ...acc, [version]: null }),
      {}
    );
    if (!authorization) {
      await packageCache.set(cacheNamespace, cacheKey, releaseMap, 30);
    }
    return releaseMap;
  }

  async addReleasesFromIndexPage(
    inputReleaseMap: ReleaseMap,
    dependency: MavenDependency,
    repoUrl: string
  ): Promise<ReleaseMap> {
    const cacheNs = 'datasource-maven:index-html-releases';
    const cacheKey = `${repoUrl}${dependency.dependencyUrl}`;
    let workingReleaseMap = await packageCache.get<ReleaseMap>(
      cacheNs,
      cacheKey
    );
    if (!workingReleaseMap) {
      workingReleaseMap = {};
      let retryEarlier = false;
      try {
        if (repoUrl.startsWith(MAVEN_REPO)) {
          const indexUrl = getMavenUrl(dependency, repoUrl, 'index.html');
          const res = await downloadHttpProtocol(this.http, indexUrl);
          const { body = '' } = res;
          for (const line of body.split(newlineRegex)) {
            const match = line.trim().match(mavenCentralHtmlVersionRegex);
            if (match) {
              const { version, releaseTimestamp: timestamp } =
                match?.groups ?? {};
              if (version && timestamp) {
                const date = DateTime.fromFormat(
                  timestamp,
                  'yyyy-MM-dd HH:mm',
                  {
                    zone: 'UTC',
                  }
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
          'Failed to get releases from index.html'
        );
      }
      const cacheTTL = retryEarlier ? 60 : 24 * 60;
      await packageCache.set(cacheNs, cacheKey, workingReleaseMap, cacheTTL);
    }

    const releaseMap = { ...inputReleaseMap };
    for (const version of Object.keys(releaseMap)) {
      releaseMap[version] ||= workingReleaseMap[version] ?? null;
    }

    return releaseMap;
  }

  async getSnapshotFullVersion(
    version: string,
    dependency: MavenDependency,
    repoUrl: string
  ): Promise<string | null> {
    // To determine what actual files are available for the snapshot, first we have to fetch and parse
    // the metadata located at http://<repo>/<group>/<artifact>/<version-SNAPSHOT>/maven-metadata.xml
    const metadataUrl = getMavenUrl(
      dependency,
      repoUrl,
      `${version}/maven-metadata.xml`
    );

    const { xml: mavenMetadata } = await downloadMavenXml(
      this.http,
      metadataUrl
    );
    if (!mavenMetadata) {
      return null;
    }

    return extractSnapshotVersion(mavenMetadata);
  }

  async createUrlForDependencyPom(
    version: string,
    dependency: MavenDependency,
    repoUrl: string
  ): Promise<string> {
    if (isSnapshotVersion(version)) {
      // By default, Maven snapshots are deployed to the repository with fixed file names.
      // Resolve the full, actual pom file name for the version.
      const fullVersion = await this.getSnapshotFullVersion(
        version,
        dependency,
        repoUrl
      );

      // If we were able to resolve the version, use that, otherwise fall back to using -SNAPSHOT
      if (fullVersion !== null) {
        return `${version}/${dependency.name}-${fullVersion}.pom`;
      }
    }

    return `${version}/${dependency.name}-${version}.pom`;
  }

  async addReleasesUsingHeadRequests(
    inputReleaseMap: ReleaseMap,
    dependency: MavenDependency,
    repoUrl: string
  ): Promise<ReleaseMap> {
    const releaseMap = { ...inputReleaseMap };

    if (process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK) {
      return releaseMap;
    }

    const cacheNs = 'datasource-maven:head-requests';
    const cacheKey = `${repoUrl}${dependency.dependencyUrl}`;
    const oldReleaseMap: ReleaseMap | undefined =
      await packageCache.get<ReleaseMap>(cacheNs, cacheKey);
    const newReleaseMap: ReleaseMap = oldReleaseMap ?? {};

    if (!oldReleaseMap) {
      const unknownVersions = Object.entries(releaseMap)
        .filter(([version, release]) => {
          const isDiscoveredOutside = !!release;
          const isDiscoveredInsideAndCached = !is.undefined(
            newReleaseMap[version]
          );
          const isDiscovered =
            isDiscoveredOutside || isDiscoveredInsideAndCached;
          return !isDiscovered;
        })
        .map(([k]) => k);

      if (unknownVersions.length) {
        let retryEarlier = false;
        const queue = unknownVersions.map(
          (version) => async (): Promise<void> => {
            const pomUrl = await this.createUrlForDependencyPom(
              version,
              dependency,
              repoUrl
            );
            const artifactUrl = getMavenUrl(dependency, repoUrl, pomUrl);
            const release: Release = { version };

            const res = await checkHttpResource(this.http, artifactUrl);

            if (res === 'error') {
              retryEarlier = true;
            }

            if (is.date(res)) {
              release.releaseTimestamp = res.toISOString();
            }

            if (res !== 'not-found' && res !== 'error') {
              newReleaseMap[version] = release;
            }
          }
        );

        await pAll(queue, { concurrency: 5 });
        const cacheTTL = retryEarlier ? 60 : 24 * 60;
        await packageCache.set(cacheNs, cacheKey, newReleaseMap, cacheTTL);
      }
    }

    for (const version of Object.keys(releaseMap)) {
      releaseMap[version] ||= newReleaseMap[version] ?? null;
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
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const dependency = getDependencyParts(lookupName);
    const repoUrl = ensureTrailingSlash(registryUrl);

    logger.debug(`Looking up ${dependency.display} in repository ${repoUrl}`);

    let releaseMap = await this.fetchReleasesFromMetadata(dependency, repoUrl);
    releaseMap = await this.addReleasesFromIndexPage(
      releaseMap,
      dependency,
      repoUrl
    );
    releaseMap = await this.addReleasesUsingHeadRequests(
      releaseMap,
      dependency,
      repoUrl
    );
    const releases = this.getReleasesFromMap(releaseMap);
    if (!releases?.length) {
      return null;
    }

    logger.debug(
      `Found ${releases.length} new releases for ${dependency.display} in repository ${repoUrl}`
    );

    const latestSuitableVersion = getLatestSuitableVersion(releases);
    const dependencyInfo =
      latestSuitableVersion &&
      (await getDependencyInfo(
        this.http,
        dependency,
        repoUrl,
        latestSuitableVersion
      ));

    return { ...dependency, ...dependencyInfo, releases };
  }
}
