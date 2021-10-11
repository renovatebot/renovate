import pMap from 'p-map';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import mavenVersion from '../../versioning/maven';
import * as mavenVersioning from '../../versioning/maven';
import { compare } from '../../versioning/maven/compare';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { MAVEN_REPO } from './common';
import type {
  ArtifactInfoResult,
  ArtifactsInfo,
  MavenDependency,
} from './types';
import {
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

function isStableVersion(x: string): boolean {
  return mavenVersion.isStable(x);
}

function getLatestStableVersion(releases: Release[]): string | null {
  const stableVersions = releases
    .map(({ version }) => version)
    .filter(isStableVersion);
  if (stableVersions.length) {
    return stableVersions.reduce((latestVersion, version) =>
      compare(version, latestVersion) === 1 ? version : latestVersion
    );
  }
  return null;
}

function extractVersions(metadata: XmlDocument): string[] {
  const versions = metadata.descendantWithPath('versioning.versions');
  const elements = versions?.childrenNamed('version');
  if (!elements) {
    return [];
  }
  return elements.map((el) => el.val);
}

async function getVersionsFromMetadata(
  dependency: MavenDependency,
  repoUrl: string
): Promise<string[] | null> {
  const metadataUrl = getMavenUrl(dependency, repoUrl, 'maven-metadata.xml');

  const cacheNamespace = 'datasource-maven-metadata';
  const cacheKey = metadataUrl.toString();
  const cachedVersions = await packageCache.get<string[]>(
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
    return null;
  }

  const versions = extractVersions(mavenMetadata);
  if (!authorization) {
    await packageCache.set(cacheNamespace, cacheKey, versions, 30);
  }
  return versions;
}

// istanbul ignore next
function isValidArtifactsInfo(
  info: ArtifactsInfo | null,
  versions: string[]
): boolean {
  if (!info) {
    return false;
  }
  return versions.every((v) => info[v] !== undefined);
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

  const { xml: mavenMetadata } = await downloadMavenXml(metadataUrl);
  if (!mavenMetadata) {
    return null;
  }

  return extractSnapshotVersion(mavenMetadata);
}

async function createUrlForDependencyPom(
  version: string,
  dependency: MavenDependency,
  repoUrl: string
): Promise<string> {
  if (isSnapshotVersion(version)) {
    // By default, Maven snapshots are deployed to the repository with fixed file names.
    // Resolve the full, actual pom file name for the version.
    const fullVersion = await getSnapshotFullVersion(
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

async function filterMissingArtifacts(
  dependency: MavenDependency,
  repoUrl: string,
  versions: string[]
): Promise<Release[]> {
  const cacheNamespace = 'datasource-maven-metadata';
  const cacheKey = `${repoUrl}${dependency.dependencyUrl}`;
  let artifactsInfo: ArtifactsInfo | null =
    await packageCache.get<ArtifactsInfo>(cacheNamespace, cacheKey);

  // If the cache contains any artifacts that we were previously unable to determine if they exist,
  // retry the existence checks on them.
  if (!isValidArtifactsInfo(artifactsInfo, versions)) {
    // For each version, determine if there is a POM file available for it
    const results: ArtifactInfoResult[] = await pMap(
      versions,
      async (version): Promise<ArtifactInfoResult | null> => {
        // Create the URL that the POM file should be available at
        const artifactUrl = getMavenUrl(
          dependency,
          repoUrl,
          await createUrlForDependencyPom(version, dependency, repoUrl)
        );

        // Return an ArtifactInfoResult that maps the version to the result of the check if the POM file exists in the repo
        return [version, await isHttpResourceExists(artifactUrl)];
      },
      { concurrency: 5 }
    );

    artifactsInfo = results.reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: value,
      }),
      {}
    );

    // Retry earlier for status other than 404
    const cacheTTL = Object.values(artifactsInfo).some((x) => x === null)
      ? 60
      : 24 * 60;

    await packageCache.set(cacheNamespace, cacheKey, artifactsInfo, cacheTTL);
  }

  // Create releases for every version that exists in the repository
  return versions
    .filter((v) => artifactsInfo[v])
    .map((version) => {
      const release: Release = { version };
      const releaseTimestamp = artifactsInfo[version];
      if (releaseTimestamp && typeof releaseTimestamp === 'string') {
        release.releaseTimestamp = releaseTimestamp;
      }
      return release;
    });
}

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const dependency = getDependencyParts(lookupName);
  let releases: Release[] = null;
  const repoForVersions = {};
  const repoUrl = registryUrl.replace(/\/?$/, '/'); // TODO #12070
  logger.debug(`Looking up ${dependency.display} in repository ${repoUrl}`);
  const metadataVersions = await getVersionsFromMetadata(dependency, repoUrl);
  if (metadataVersions) {
    if (!process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK) {
      releases = await filterMissingArtifacts(
        dependency,
        repoUrl,
        metadataVersions
      );
    }

    /* istanbul ignore next */
    releases = releases || metadataVersions.map((version) => ({ version }));

    const latestVersion = getLatestStableVersion(releases);
    if (latestVersion) {
      repoForVersions[latestVersion] = repoUrl;
    }

    logger.debug(`Found ${releases.length} new releases for ${dependency.display} in repository ${repoUrl}`); // prettier-ignore
  }

  if (!releases?.length) {
    return null;
  }

  let dependencyInfo = {};
  const latestVersion = getLatestStableVersion(releases);
  if (latestVersion) {
    dependencyInfo = await getDependencyInfo(
      dependency,
      repoForVersions[latestVersion],
      latestVersion
    );
  }

  return {
    ...dependency,
    ...dependencyInfo,
    releases,
  };
}
