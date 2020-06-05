import url from 'url';
import fs from 'fs-extra';
import pAll from 'p-all';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../logger';
import * as globalCache from '../../util/cache/global';
import mavenVersion from '../../versioning/maven';
import { compare } from '../../versioning/maven/compare';
import { GetReleasesConfig, ReleaseResult } from '../common';
import { MAVEN_REPO } from './common';
import { downloadHttpProtocol, isHttpResourceExists } from './util';

export { id } from './common';

export const defaultRegistryUrls = [MAVEN_REPO];

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
  try {
    return new url.URL(`${dependency.dependencyUrl}/${path}`, repoUrl);
  } catch (err) {
    logger.debug(
      { err, dependency, repoUrl, path },
      `Error constructing URL for ${dependency.display}`
    );
  }
  return null;
}

async function downloadMavenXml(
  pkgUrl: url.URL | null
): Promise<XmlDocument | null> {
  /* istanbul ignore if */
  if (!pkgUrl) {
    return null;
  }
  let rawContent: string;
  switch (pkgUrl.protocol) {
    case 'file:':
      rawContent = await downloadFileProtocol(pkgUrl);
      break;
    case 'http:':
    case 'https:':
      rawContent = await downloadHttpProtocol(pkgUrl);
      break;
    case 's3:':
      logger.debug('Skipping s3 dependency');
      return null;
    default:
      logger.warn(
        `Invalid protocol '${pkgUrl.protocol}' for Maven url: ${pkgUrl}`
      );
      return null;
  }

  if (!rawContent) {
    logger.debug(`Content is not found for Maven url: ${pkgUrl}`);
    return null;
  }

  try {
    return new XmlDocument(rawContent);
  } catch (e) {
    logger.debug(`Can not parse ${pkgUrl.href}`);
    return null;
  }
}

async function getDependencyInfo(
  dependency: MavenDependency,
  repoUrl: string,
  version: string
): Promise<Partial<ReleaseResult>> {
  const result: Partial<ReleaseResult> = {};
  const path = `${version}/${dependency.name}-${version}.pom`;

  const pomUrl = getMavenUrl(dependency, repoUrl, path);
  const pomContent = await downloadMavenXml(pomUrl);
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

function getLatestStableVersion(versions: string[]): string | null {
  const { isStable } = mavenVersion; // auto this bind
  const stableVersions = versions.filter(isStable);
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
  const elements = versions && versions.childrenNamed('version');
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
  if (!metadataUrl) {
    return null;
  }

  const cacheNamespace = 'datasource-maven-metadata';
  const cacheKey = metadataUrl.toString();
  const cachedVersions = await globalCache.get<string[]>(
    cacheNamespace,
    cacheKey
  );
  /* istanbul ignore if */
  if (cachedVersions) {
    return cachedVersions;
  }

  const mavenMetadata = await downloadMavenXml(metadataUrl);
  if (!mavenMetadata) {
    return null;
  }

  const versions = extractVersions(mavenMetadata);
  await globalCache.set(cacheNamespace, cacheKey, versions, 10);
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

type ArtifactInfoResult = [string, boolean | null];

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
): Promise<string[]> {
  const cacheNamespace = 'datasource-maven-metadata';
  const cacheKey = dependency.dependencyUrl;
  let artifactsInfo: ArtifactsInfo | null = await globalCache.get<
    ArtifactsInfo
  >(cacheNamespace, cacheKey);

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

    await globalCache.set(cacheNamespace, cacheKey, artifactsInfo, cacheTTL);
  }

  return versions.filter((v) => artifactsInfo[v]);
}

export async function getReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const repositories = registryUrls.map((repository) =>
    repository.replace(/\/?$/, '/')
  );
  const dependency = getDependencyParts(lookupName);
  const versions: string[] = [];
  const repoForVersions = {};
  for (let i = 0; i < repositories.length; i += 1) {
    const repoUrl = repositories[i];
    logger.debug(
      `Looking up ${dependency.display} in repository #${i} - ${repoUrl}`
    );
    const metadataVersions = await getVersionsFromMetadata(dependency, repoUrl);
    if (metadataVersions) {
      const availableVersions = await filterMissingArtifacts(
        dependency,
        repoUrl,
        metadataVersions
      );
      const filteredVersions = availableVersions.filter(
        (version) => !versions.includes(version)
      );
      versions.push(...filteredVersions);

      const latestVersion = getLatestStableVersion(filteredVersions);
      if (latestVersion) {
        repoForVersions[latestVersion] = repoUrl;
      }

      logger.debug(`Found ${availableVersions.length} new versions for ${dependency.display} in repository ${repoUrl}`); // prettier-ignore
    }
  }

  if (versions.length === 0) {
    logger.debug(`No versions found for ${dependency.display} in ${repositories.length} repositories`); // prettier-ignore
    return null;
  }
  logger.debug(`Found ${versions.length} versions for ${dependency.display}`);

  let dependencyInfo = {};
  const latestVersion = getLatestStableVersion(versions);
  if (latestVersion) {
    const repoUrl = repoForVersions[latestVersion];
    dependencyInfo = await getDependencyInfo(
      dependency,
      repoUrl,
      latestVersion
    );
  }

  return {
    ...dependency,
    ...dependencyInfo,
    releases: versions.map((v) => ({ version: v })),
  };
}
