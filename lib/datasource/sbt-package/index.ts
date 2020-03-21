import { compare } from '../../versioning/maven/compare';
import { downloadHttpProtocol } from '../maven/util';
import { parseIndexDir } from '../sbt-plugin/util';
import { logger } from '../../logger';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'sbt-package';

const ensureTrailingSlash = (str: string): string => str.replace(/\/?$/, '/');

export async function resolvePackageReleases(
  searchRoot: string,
  artifact: string,
  scalaVersion: string
): Promise<string[]> {
  const indexContent = await downloadHttpProtocol(
    ensureTrailingSlash(searchRoot),
    'sbt'
  );
  if (indexContent) {
    const releases: string[] = [];
    const parseSubdirs = (content: string): string[] =>
      parseIndexDir(content, x => {
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
    const artifactSubdirs = parseSubdirs(indexContent);
    let searchSubdirs = artifactSubdirs;
    if (
      scalaVersion &&
      artifactSubdirs.includes(`${artifact}_${scalaVersion}`)
    ) {
      searchSubdirs = [`${artifact}_${scalaVersion}`];
    }
    const parseReleases = (content: string): string[] =>
      parseIndexDir(content, x => !/^\.+$/.test(x));
    for (const searchSubdir of searchSubdirs) {
      const content = await downloadHttpProtocol(
        ensureTrailingSlash(`${searchRoot}/${searchSubdir}`),
        'sbt'
      );
      if (content) {
        const subdirReleases = parseReleases(content);
        subdirReleases.forEach(x => releases.push(x));
      }
    }
    if (releases.length) {
      return [...new Set(releases)].sort(compare);
    }
  }

  return null;
}

export async function getPkgReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const [groupId, artifactId] = lookupName.split(':');
  const groupIdSplit = groupId.split('.');
  const artifactIdSplit = artifactId.split('_');
  const [artifact, scalaVersion] = artifactIdSplit;

  const repoRoots = registryUrls.map(x => x.replace(/\/?$/, ''));
  const searchRoots: string[] = [];
  repoRoots.forEach(repoRoot => {
    // Optimize lookup order
    searchRoots.push(`${repoRoot}/${groupIdSplit.join('/')}`);
    searchRoots.push(`${repoRoot}/${groupIdSplit.join('.')}`);
  });

  for (let idx = 0; idx < searchRoots.length; idx += 1) {
    const searchRoot = searchRoots[idx];
    const versions = await resolvePackageReleases(
      searchRoot,
      artifact,
      scalaVersion
    );

    const dependencyUrl = searchRoot;

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
