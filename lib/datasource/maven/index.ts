import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import pAll from 'p-all';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import mavenVersion from '../../versioning/maven';
import * as mavenVersioning from '../../versioning/maven';
import { compare } from '../../versioning/maven/compare';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { MAVEN_REPO } from './common';
import type { MavenDependency } from './types';
import {
  downloadHttpProtocol,
  downloadMavenXml,
  getDependencyInfo,
  getDependencyParts,
  getMavenUrl,
  isHttpResourceExists,
} from './util';

export { id } from './common';

export const customRegistrySupport = true;
export const defaultRegistryUrls = [MAVEN_REPO];
export const defaultVersioning = mavenVersioning.id;
export const registryStrategy = 'merge';

type ReleaseMap = Record<string, Release | null>;

function extractVersions(metadata: XmlDocument): string[] {
  const versions = metadata.descendantWithPath('versioning.versions');
  const elements = versions?.childrenNamed('version');
  if (!elements) {
    return [];
  }
  return elements.map((el) => el.val);
}

async function fetchReleasesFromMetadata(
  mvnDep: MavenDependency,
  repoUrl: string
): Promise<ReleaseMap> {
  const metadataUrl = getMavenUrl(mvnDep, repoUrl, 'maven-metadata.xml');

  const cacheNamespace = 'datasource-maven-metadata@v2';
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

const mavenCentralHtmlVersionRegex =
  /<a href="(?<version>[^"]+)\/" title="\k<version>\/">\k<version>\/<\/a>\s+(?<releaseTimestamp>\d\d\d\d-\d\d-\d\d \d\d:\d\d)\s+-/gi;

async function addReleasesFromIndexPage(
  inputReleaseMap: ReleaseMap,
  dependency: MavenDependency,
  repoUrl: string
): Promise<ReleaseMap> {
  const releaseMap = { ...inputReleaseMap };
  try {
    if (repoUrl.startsWith(MAVEN_REPO)) {
      const indexUrl = getMavenUrl(dependency, repoUrl, 'index.html');
      const res = await downloadHttpProtocol(indexUrl);
      const { body } = res;
      const matches = Array.from(body.matchAll(mavenCentralHtmlVersionRegex));
      for (const match of matches) {
        const { version, releaseTimestamp: timestamp } = match?.groups || {};
        if (version && timestamp) {
          const date = DateTime.fromFormat(timestamp, 'yyyy-MM-dd HH:mm', {
            zone: 'UTC',
          });
          if (date.isValid) {
            const releaseTimestamp = date.toISO();
            releaseMap[version] = { version, releaseTimestamp };
          }
        }
      }
    }
  } catch (err) {
    logger.debug({ dependency, err }, 'Failed to get releases');
  }

  return releaseMap;
}

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

async function getSnapshotFullVersion(
  version: string,
  mvnDep: MavenDependency,
  repoUrl: string
): Promise<string | null> {
  // To determine what actual files are available for the snapshot, first we have to fetch and parse
  // the metadata located at http://<repo>/<group>/<artifact>/<version-SNAPSHOT>/maven-metadata.xml
  const metadataUrl = getMavenUrl(
    mvnDep,
    repoUrl,
    `${version}/maven-metadata.xml`
  );

  const { xml: mavenMetadata } = await downloadMavenXml(metadataUrl);
  if (!mavenMetadata) {
    return null;
  }

  return extractSnapshotVersion(mavenMetadata);
}

async function createUrlForDependencyPom(
  version: string,
  mvnDep: MavenDependency,
  repoUrl: string
): Promise<string> {
  if (isSnapshotVersion(version)) {
    // By default, Maven snapshots are deployed to the repository with fixed file names.
    // Resolve the full, actual pom file name for the version.
    const fullVersion = await getSnapshotFullVersion(version, mvnDep, repoUrl);

    // If we were able to resolve the version, use that, otherwise fall back to using -SNAPSHOT
    if (fullVersion !== null) {
      return `${version}/${mvnDep.name}-${fullVersion}.pom`;
    }
  }

  return `${version}/${mvnDep.name}-${version}.pom`;
}

async function addReleasesUsingHeadRequests(
  inputReleaseMap: ReleaseMap,
  mvnDep: MavenDependency,
  repoUrl: string
): Promise<ReleaseMap> {
  const releaseMap = { ...inputReleaseMap };

  if (process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK) {
    return releaseMap;
  }

  const cacheNs = 'datasource-maven-metadata@v2';
  const cacheKey = `${repoUrl}${mvnDep.dependencyUrl}`;
  let workingReleaseMap: ReleaseMap = await packageCache.get<ReleaseMap>(
    cacheNs,
    cacheKey
  );

  if (!workingReleaseMap) {
    workingReleaseMap = {};

    const unknownVersions = Object.entries(releaseMap)
      .filter(([version, release]) => {
        const isDiscoveredOutside = !!release;
        const isDiscoveredInsideAndCached = !is.undefined(
          workingReleaseMap[version]
        );
        const isDiscovered = isDiscoveredOutside || isDiscoveredInsideAndCached;
        return !isDiscovered;
      })
      .map(([k]) => k);

    if (unknownVersions.length) {
      let retryEarlier = false;
      const queue = unknownVersions.map(
        (version) => async (): Promise<void> => {
          const pomUrl = await createUrlForDependencyPom(
            version,
            mvnDep,
            repoUrl
          );
          const artifactUrl = getMavenUrl(mvnDep, repoUrl, pomUrl);
          const res = await isHttpResourceExists(artifactUrl);
          const release: Release = { version };

          if (is.string(res)) {
            release.releaseTimestamp = res;
          }

          // Retry earlier for error status other than 404
          if (res === null) {
            retryEarlier = true;
          }

          workingReleaseMap[version] = res ? release : null;
        }
      );

      await pAll(queue, { concurrency: 5 });
      const cacheTTL = retryEarlier ? 60 : 24 * 60;
      await packageCache.set(cacheNs, cacheKey, workingReleaseMap, cacheTTL);
    }
  }

  for (const version of Object.keys(releaseMap)) {
    releaseMap[version] ||= workingReleaseMap[version] ?? null;
  }

  return releaseMap;
}

function getReleasesFromMap(releaseMap: ReleaseMap): Release[] {
  const releases = Object.values(releaseMap).filter(Boolean);
  if (releases.length) {
    return releases;
  }
  return Object.keys(releaseMap).map((version) => ({ version }));
}

function isStableVersion(x: string): boolean {
  return mavenVersion.isStable(x);
}

function getLatestStableVersion(releases: Release[]): string | undefined {
  return releases
    .map(({ version }) => version)
    .filter(isStableVersion)
    .reduce((latestVersion, version) =>
      compare(version, latestVersion) === 1 ? version : latestVersion
    );
}

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const mvnDep = getDependencyParts(lookupName);
  const repoUrl = registryUrl.replace(/\/?$/, '/'); // TODO #12070

  logger.debug(`Looking up ${mvnDep.display} in repository ${repoUrl}`);

  let releaseMap = await fetchReleasesFromMetadata(mvnDep, repoUrl);
  releaseMap = await addReleasesFromIndexPage(releaseMap, mvnDep, repoUrl);
  releaseMap = await addReleasesUsingHeadRequests(releaseMap, mvnDep, repoUrl);
  const releases = getReleasesFromMap(releaseMap);
  if (!releases?.length) {
    return null;
  }

  logger.debug(
    `Found ${releases.length} new releases for ${mvnDep.display} in repository ${repoUrl}`
  );

  const latestStableVersion = getLatestStableVersion(releases);
  const depInfo =
    latestStableVersion &&
    (await getDependencyInfo(mvnDep, repoUrl, latestStableVersion));

  return { ...mvnDep, ...depInfo, releases };
}
