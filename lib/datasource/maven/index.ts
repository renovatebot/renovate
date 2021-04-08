import url from 'url';
import fs from 'fs-extra';
import pAll from 'p-all';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import mavenVersion from '../../versioning/maven';
import * as mavenVersioning from '../../versioning/maven';
import { compare } from '../../versioning/maven/compare';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { MAVEN_REPO } from './common';
import { downloadHttpProtocol, isHttpResourceExists } from './util';

export { id } from './common';

export const customRegistrySupport = true;
export const defaultRegistryUrls = [MAVEN_REPO];
export const defaultVersioning = mavenVersioning.id;
export const registryStrategy = 'merge';

function containsPlaceholder(str: string): boolean {
  return /\${.*?}/g.test(str);
}

async function downloadFileProtocol(pkgUrl: url.URL): Promise<string | null> {
  const pkgPath = pkgUrl.toString().replace('file://', '');
  if (!(await fs.exists(pkgPath))) {
    return null;
  }
  return fs.readFile(pkgPath, 'utf8');
}

function getMavenUrl(
  dependency: MavenDependency,
  repoUrl: string,
  path: string
): url.URL | null {
  return new url.URL(`${dependency.dependencyUrl}/${path}`, repoUrl);
}

interface MavenXml {
  authorization?: boolean;
  xml?: XmlDocument;
}

async function downloadMavenXml(
  pkgUrl: url.URL | null
): Promise<MavenXml | null> {
  /* istanbul ignore if */
  if (!pkgUrl) {
    return {};
  }
  let rawContent: string;
  let authorization: boolean;
  switch (pkgUrl.protocol) {
    case 'file:':
      rawContent = await downloadFileProtocol(pkgUrl);
      break;
    case 'http:':
    case 'https:':
      ({ authorization, body: rawContent } = await downloadHttpProtocol(
        pkgUrl
      ));
      break;
    case 's3:':
      logger.debug('Skipping s3 dependency');
      return {};
    default:
      logger.debug({ url: pkgUrl.toString() }, `Unsupported Maven protocol`);
      return {};
  }

  if (!rawContent) {
    logger.debug(`Content is not found for Maven url: ${pkgUrl.toString()}`);
    return {};
  }

  return { authorization, xml: new XmlDocument(rawContent) };
}

async function getDependencyInfo(
  dependency: MavenDependency,
  repoUrl: string,
  version: string
): Promise<Partial<ReleaseResult>> {
  const result: Partial<ReleaseResult> = {};
  const path = `${version}/${dependency.name}-${version}.pom`;

  const pomUrl = getMavenUrl(dependency, repoUrl, path);
  const { xml: pomContent } = await downloadMavenXml(pomUrl);
  if (!pomContent) {
    return result;
  }

  const homepage = pomContent.valueWithPath('url');
  if (homepage && !containsPlaceholder(homepage)) {
    result.homepage = homepage;
  }

  const sourceUrl = pomContent.valueWithPath('scm.url');
  if (sourceUrl && !containsPlaceholder(sourceUrl)) {
    result.sourceUrl = sourceUrl.replace(/^scm:/, '');
  }

  return result;
}

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

interface MavenDependency {
  display: string;
  group?: string;
  name?: string;
  dependencyUrl: string;
}

function getDependencyParts(lookupName: string): MavenDependency {
  const [group, name] = lookupName.split(':');
  const dependencyUrl = `${group.replace(/\./g, '/')}/${name}`;
  return {
    display: lookupName,
    group,
    name,
    dependencyUrl,
  };
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

type ArtifactsInfo = Record<string, boolean | null>;

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

type ArtifactInfoResult = [string, boolean | string | null];

async function getArtifactInfo(
  version: string,
  artifactUrl: url.URL
): Promise<ArtifactInfoResult> {
  const proto = artifactUrl.protocol;
  if (proto === 'http:' || proto === 'https:') {
    const result = await isHttpResourceExists(artifactUrl);
    return [version, result];
  }
  return [version, true];
}

async function filterMissingArtifacts(
  dependency: MavenDependency,
  repoUrl: string,
  versions: string[]
): Promise<Release[]> {
  const cacheNamespace = 'datasource-maven-metadata';
  const cacheKey = `${repoUrl}${dependency.dependencyUrl}`;
  let artifactsInfo: ArtifactsInfo | null = await packageCache.get<ArtifactsInfo>(
    cacheNamespace,
    cacheKey
  );

  if (!isValidArtifactsInfo(artifactsInfo, versions)) {
    const queue = versions
      .map((version): [string, url.URL | null] => {
        const artifactUrl = getMavenUrl(
          dependency,
          repoUrl,
          `${version}/${dependency.name}-${version}.pom`
        );
        return [version, artifactUrl];
      })
      .filter(([_, artifactUrl]) => Boolean(artifactUrl))
      .map(([version, artifactUrl]) => (): Promise<ArtifactInfoResult> =>
        getArtifactInfo(version, artifactUrl)
      );
    const results = await pAll(queue, { concurrency: 5 });
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
  const repoUrl = registryUrl.replace(/\/?$/, '/');
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
