import { compare } from '../../versioning/maven/compare';
import { downloadHttpProtocol } from '../maven/util';
import { parseIndexDir, SBT_PLUGINS_REPO } from './util';
import { logger } from '../../logger';
import { GetReleasesConfig, ReleaseResult } from '../common';
import { resolvePackageReleases } from '../sbt-package';

export const id = 'sbt-plugin';

const ensureTrailingSlash = (str: string): string => str.replace(/\/?$/, '/');

async function resolvePluginReleases(
  rootUrl: string,
  artifact: string,
  scalaVersion: string
): Promise<string[]> {
  const searchRoot = `${rootUrl}/${artifact}`;
  const parse = (content: string): string[] =>
    parseIndexDir(content, x => !/^\.+$/.test(x));
  const indexContent = await downloadHttpProtocol(
    ensureTrailingSlash(searchRoot),
    'sbt'
  );
  if (indexContent) {
    const releases: string[] = [];
    const scalaVersionItems = parse(indexContent);
    const scalaVersions = scalaVersionItems.map(x => x.replace(/^scala_/, ''));
    const searchVersions = !scalaVersions.includes(scalaVersion)
      ? scalaVersions
      : [scalaVersion];
    for (const searchVersion of searchVersions) {
      const searchSubRoot = `${searchRoot}/scala_${searchVersion}`;
      const subRootContent = await downloadHttpProtocol(
        ensureTrailingSlash(searchSubRoot),
        'sbt'
      );
      if (subRootContent) {
        const sbtVersionItems = parse(subRootContent);
        for (const sbtItem of sbtVersionItems) {
          const releasesRoot = `${searchSubRoot}/${sbtItem}`;
          const releasesIndexContent = await downloadHttpProtocol(
            ensureTrailingSlash(releasesRoot),
            'sbt'
          );
          if (releasesIndexContent) {
            const releasesParsed = parse(releasesIndexContent);
            releasesParsed.forEach(x => releases.push(x));
          }
        }
      }
    }
    if (releases.length) {
      return [...new Set(releases)].sort(compare);
    }
  }
  return resolvePackageReleases(rootUrl, artifact, scalaVersion);
}

export async function getPkgReleases({
  lookupName,
  registryUrls: configRegistryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const registryUrls = [SBT_PLUGINS_REPO, ...configRegistryUrls];

  const [groupId, artifactId] = lookupName.split(':');
  const groupIdSplit = groupId.split('.');
  const artifactIdSplit = artifactId.split('_');
  const [artifact, scalaVersion] = artifactIdSplit;

  const repoRoots = registryUrls.map(x => x.replace(/\/?$/, ''));
  const searchRoots: string[] = [];
  repoRoots.forEach(repoRoot => {
    // Optimize lookup order
    searchRoots.push(`${repoRoot}/${groupIdSplit.join('.')}`);
    searchRoots.push(`${repoRoot}/${groupIdSplit.join('/')}`);
  });

  for (let idx = 0; idx < searchRoots.length; idx += 1) {
    const searchRoot = searchRoots[idx];
    const versions = await resolvePluginReleases(
      searchRoot,
      artifact,
      scalaVersion
    );

    const dependencyUrl = `${searchRoot}/${artifact}`;

    if (versions) {
      return {
        display: lookupName,
        group: groupId,
        name: artifactId,
        dependencyUrl,
        releases: versions.map(v => ({ version: v })),
      };
    }
  }

  logger.debug(
    `No versions found for ${lookupName} in ${searchRoots.length} repositories`
  );
  return null;
}
