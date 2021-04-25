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
  groupId: string,
  artifact: string,
  scalaVersion: string
): Promise<string[]> {
  const searchRoot = `${rootUrl}${groupId}/${artifact}`;
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
  const groupIds: string[] = [];
  // Optimize lookup order
  groupIds.push(`${groupIdSplit.join('/')}`);
  groupIds.push(`${groupIdSplit.join('.')}`);

  for (let idx = 0; idx < groupIds.length; idx += 1) {
    const groupIdLookup = groupIds[idx];
    let versions = await resolvePluginReleases(
      repoRoot,
      groupIdLookup,
      artifact,
      scalaVersion
    );
    let urls = {};

    if (!versions?.length) {
      const artifactSubdirs = await getArtifactSubdirs(
        repoRoot,
        groupIdLookup,
        artifact,
        scalaVersion
      );
      versions = await getPackageReleases(
        repoRoot,
        groupIdLookup,
        artifactSubdirs
      );
      const latestVersion = getLatestVersion(versions);
      urls = await getUrls(
        repoRoot,
        groupIdLookup,
        artifactSubdirs,
        latestVersion
      );
    }

    const dependencyUrl = `${repoRoot}${groupIdLookup}/${artifact}`;

    if (versions) {
      return {
        ...urls,
        dependencyUrl,
        releases: versions.map((v) => ({ version: v })),
      };
    }
  }

  logger.debug(
    `No versions found for ${lookupName} in ${groupIds.length} repositories`
  );
  return null;
}
