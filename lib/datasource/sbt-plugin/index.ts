import { logger } from '../../logger';
import * as ivyVersioning from '../../versioning/ivy';
import { compare } from '../../versioning/maven/compare';
import { downloadHttpProtocol } from '../maven/util';
import {
  getArtifactSubdirs,
  getLatestVersion,
  getPackageReleases,
  getUrls,
} from '../sbt-package';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { SBT_PLUGINS_REPO, parseIndexDir } from './util';

export const id = 'sbt-plugin';
export const customRegistrySupport = true;
export const defaultRegistryUrls = [SBT_PLUGINS_REPO];
export const defaultVersioning = ivyVersioning.id;
export const registryStrategy = 'hunt';

const ensureTrailingSlash = (str: string): string => str.replace(/\/?$/, '/');

async function resolvePluginReleases(
  rootUrl: string,
  artifact: string,
  scalaVersion: string
): Promise<string[]> {
  const searchRoot = `${rootUrl}/${artifact}`;
  const parse = (content: string): string[] =>
    parseIndexDir(content, (x) => !/^\.+$/.test(x));
  const { body: indexContent } = await downloadHttpProtocol(
    ensureTrailingSlash(searchRoot),
    'sbt'
  );
  if (indexContent) {
    const releases: string[] = [];
    const scalaVersionItems = parse(indexContent);
    const scalaVersions = scalaVersionItems.map((x) =>
      x.replace(/^scala_/, '')
    );
    const searchVersions = scalaVersions.includes(scalaVersion)
      ? [scalaVersion]
      : scalaVersions;
    for (const searchVersion of searchVersions) {
      const searchSubRoot = `${searchRoot}/scala_${searchVersion}`;
      const { body: subRootContent } = await downloadHttpProtocol(
        ensureTrailingSlash(searchSubRoot),
        'sbt'
      );
      if (subRootContent) {
        const sbtVersionItems = parse(subRootContent);
        for (const sbtItem of sbtVersionItems) {
          const releasesRoot = `${searchSubRoot}/${sbtItem}`;
          const { body: releasesIndexContent } = await downloadHttpProtocol(
            ensureTrailingSlash(releasesRoot),
            'sbt'
          );
          if (releasesIndexContent) {
            const releasesParsed = parse(releasesIndexContent);
            releasesParsed.forEach((x) => releases.push(x));
          }
        }
      }
    }
    if (releases.length) {
      return [...new Set(releases)].sort(compare);
    }
  }
  return null;
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
  const searchRoots: string[] = [];
  // Optimize lookup order
  searchRoots.push(`${repoRoot}${groupIdSplit.join('.')}`);
  searchRoots.push(`${repoRoot}${groupIdSplit.join('/')}`);

  for (let idx = 0; idx < searchRoots.length; idx += 1) {
    const searchRoot = searchRoots[idx];
    let versions = await resolvePluginReleases(
      searchRoot,
      artifact,
      scalaVersion
    );
    let urls = {};

    if (!versions?.length) {
      const artifactSubdirs = await getArtifactSubdirs(
        searchRoot,
        artifact,
        scalaVersion
      );
      versions = await getPackageReleases(searchRoot, artifactSubdirs);
      const latestVersion = getLatestVersion(versions);
      urls = await getUrls(searchRoot, artifactSubdirs, latestVersion);
    }

    const dependencyUrl = `${searchRoot}/${artifact}`;

    if (versions) {
      return {
        ...urls,
        dependencyUrl,
        releases: versions.map((v) => ({ version: v })),
      };
    }
  }

  logger.debug(
    `No versions found for ${lookupName} in ${searchRoots.length} repositories`
  );
  return null;
}
