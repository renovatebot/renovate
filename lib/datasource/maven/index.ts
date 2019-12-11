import is from '@sindresorhus/is';
import url from 'url';
import fs from 'fs-extra';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../logger';
import { compare } from '../../versioning/maven/compare';
import mavenVersion from '../../versioning/maven';
import { containsPlaceholder } from '../../manager/maven/extract';
import { downloadHttpProtocol } from './util';
import { PkgReleaseConfig, ReleaseResult } from '../common';

async function downloadFileProtocol(pkgUrl: url.URL): Promise<string | null> {
  const pkgPath = pkgUrl.toString().replace('file://', '');
  if (!(await fs.exists(pkgPath))) {
    return null;
  }
  return fs.readFile(pkgPath, 'utf8');
}

async function downloadMavenXml(
  dependency: MavenDependency,
  repoUrl: string,
  dependencyFilePath: string
): Promise<XmlDocument | null> {
  let pkgUrl;
  try {
    pkgUrl = new url.URL(
      `${dependency.dependencyUrl}/${dependencyFilePath}`,
      repoUrl
    );
  } catch (err) {
    logger.debug(
      { err, dependency, repoUrl, dependencyFilePath },
      `Error constructing URL for ${dependency.display}`
    );
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
        `Invalid protocol ${pkgUrl.protocol} in repository ${repoUrl}`
      );
      return null;
  }

  if (!rawContent) {
    logger.debug(`${dependency.display} not found in repository ${repoUrl}`);
    return null;
  }

  try {
    return new XmlDocument(rawContent);
  } catch (e) {
    logger.debug(`Can not parse ${pkgUrl.href} for ${dependency.display}`);
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

  const pomContent = await downloadMavenXml(dependency, repoUrl, path);
  if (!pomContent) return result;

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
  const stableVersions = versions.filter(mavenVersion.isStable);
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
  if (!elements) return [];
  return elements.map(el => el.val);
}

export async function getPkgReleases({
  lookupName,
  registryUrls,
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  const versions: string[] = [];
  const dependency = getDependencyParts(lookupName);
  if (!is.nonEmptyArray(registryUrls)) {
    logger.warn(`No repositories defined for ${dependency.display}`);
    return null;
  }
  const repositories = registryUrls.map(repository =>
    repository.replace(/\/?$/, '/')
  );
  logger.debug(
    `Found ${repositories.length} repositories for ${dependency.display}`
  );
  const repoForVersions = {};
  for (let i = 0; i < repositories.length; i += 1) {
    const repoUrl = repositories[i];
    logger.debug(
      `Looking up ${dependency.display} in repository #${i} - ${repoUrl}`
    );
    const mavenMetadata = await downloadMavenXml(
      dependency,
      repoUrl,
      'maven-metadata.xml'
    );
    if (mavenMetadata) {
      const newVersions = extractVersions(mavenMetadata).filter(
        version => !versions.includes(version)
      );
      const latestVersion = getLatestStableVersion(newVersions);
      if (latestVersion) {
        repoForVersions[latestVersion] = repoUrl;
      }
      versions.push(...newVersions);
      logger.debug(`Found ${newVersions.length} new versions for ${dependency.display} in repository ${repoUrl}`); // prettier-ignore
    }
  }

  if (versions.length === 0) {
    logger.info(`No versions found for ${dependency.display} in ${repositories.length} repositories`); // prettier-ignore
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
    releases: versions.map(v => ({ version: v })),
  };
}
