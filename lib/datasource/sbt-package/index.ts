import { logger } from '../../logger';
import * as ivyVersioning from '../../versioning/ivy';
import { compare } from '../../versioning/maven/compare';
import { MAVEN_REPO } from '../maven/common';
import {
  MavenDependency,
  downloadHttpProtocol,
  getDependencyInfo,
} from '../maven/util';
import { parseIndexDir } from '../sbt-plugin/util';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'sbt-package';
export const customRegistrySupport = true;
export const defaultRegistryUrls = [MAVEN_REPO];
export const defaultVersioning = ivyVersioning.id;
export const registryStrategy = 'hunt';

const ensureTrailingSlash = (str: string): string => str.replace(/\/?$/, '/');

export async function getArtifactSubdirs(
  registryUrl: string,
  groupId: string,
  artifact: string,
  scalaVersion: string
): Promise<string[]> {
  const searchRoot = `${registryUrl}${groupId}`;

  const { body: indexContent } = await downloadHttpProtocol(
    ensureTrailingSlash(searchRoot),
    'sbt'
  );
  if (indexContent) {
    const parseSubdirs = (content: string): string[] =>
      parseIndexDir(content, (x) => {
        if (x === artifact) {
          return true;
        }
        if (x.startsWith(`${artifact}_native`)) {
          return false;
        }
        if (x.startsWith(`${artifact}_sjs`)) {
          return false;
        }
        return x.startsWith(`${artifact}_`);
      });
    let artifactSubdirs = parseSubdirs(indexContent);
    if (
      scalaVersion &&
      artifactSubdirs.includes(`${artifact}_${scalaVersion}`)
    ) {
      artifactSubdirs = [`${artifact}_${scalaVersion}`];
    }
    return artifactSubdirs;
  }

  return null;
}

export async function getPackageReleases(
  registryUrl: string,
  groupId: string,
  artifactSubdirs: string[]
): Promise<string[]> {
  const searchRoot = `${registryUrl}${groupId}`;
  if (artifactSubdirs) {
    const releases: string[] = [];
    const parseReleases = (content: string): string[] =>
      parseIndexDir(content, (x) => !/^\.+$/.test(x));
    for (const searchSubdir of artifactSubdirs) {
      const { body: content } = await downloadHttpProtocol(
        ensureTrailingSlash(`${searchRoot}/${searchSubdir}`),
        'sbt'
      );
      if (content) {
        const subdirReleases = parseReleases(content);
        subdirReleases.forEach((x) => releases.push(x));
      }
    }
    if (releases.length) {
      return [...new Set(releases)].sort(compare);
    }
  }

  return null;
}

export function getLatestVersion(versions: string[]): string | null {
  if (versions?.length) {
    return versions.reduce((latestVersion, version) =>
      compare(version, latestVersion) === 1 ? version : latestVersion
    );
  }
  return null;
}

export async function getUrls(
  repositoryUrl: string,
  groupId: string,
  artifactDirs: string[],
  version: string
): Promise<Partial<ReleaseResult>> {
  const result: Partial<ReleaseResult> = {};

  if (!artifactDirs?.length) {
    return result;
  }

  if (!version) {
    return result;
  }

  for (const artifactDir of artifactDirs) {
    const [artifact] = artifactDir.split('_');
    const namesToTry: string[] = [];
    namesToTry.push(artifactDir);
    namesToTry.push(artifact);

    for (const mavenName of namesToTry) {
      const mavenDependency: MavenDependency = {
        dependencyUrl: `${repositoryUrl}${groupId}/${artifactDir}`,
        display: `${artifactDir}:${artifact}:${version}`,
        group: artifactDir,
        name: mavenName,
      };

      const dependencyInfo = await getDependencyInfo(
        mavenDependency,
        repositoryUrl,
        version
      );

      if (dependencyInfo.homepage || dependencyInfo.sourceUrl) {
        result.homepage = dependencyInfo.homepage;
        result.sourceUrl = dependencyInfo.sourceUrl;
        return result;
      }
    }
  }

  return result;
}

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const [groupId, artifactId] = lookupName.split(':');
  const groupIdSplit = groupId.split('.');
  const artifactIdSplit = artifactId.split('_');
  const [artifact, scalaVersion] = artifactIdSplit;

  const repoRoot = ensureTrailingSlash(registryUrl);
  const groupIds: string[] = [];
  // Optimize lookup order
  groupIds.push(`${groupIdSplit.join('/')}`);
  groupIds.push(`${groupIdSplit.join('.')}`);

  for (let idx = 0; idx < groupIds.length; idx += 1) {
    const groupIdLookup = groupIds[idx];
    const artifactSubdirs = await getArtifactSubdirs(
      repoRoot,
      groupIdLookup,
      artifact,
      scalaVersion
    );
    const versions = await getPackageReleases(
      repoRoot,
      groupIdLookup,
      artifactSubdirs
    );
    const latestVersion = getLatestVersion(versions);
    const urls = await getUrls(
      repoRoot,
      groupIdLookup,
      artifactSubdirs,
      latestVersion
    );

    const dependencyUrl = `${repoRoot}${groupIdLookup}`;

    if (versions) {
      return {
        ...urls,
        dependencyUrl,
        releases: versions.map((v) => ({ version: v })),
      };
    }
  }

  logger.debug(
    `No versions found for ${lookupName} in ${groupIdSplit.length} repositories`
  );
  return null;
}
