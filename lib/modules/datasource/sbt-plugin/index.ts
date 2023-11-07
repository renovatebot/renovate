import { logger } from '../../../logger';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import * as ivyVersioning from '../../versioning/ivy';
import { compare } from '../../versioning/maven/compare';
import { downloadHttpProtocol } from '../maven/util';
import { SbtPackageDatasource } from '../sbt-package';
import { getLatestVersion, parseIndexDir } from '../sbt-package/util';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const SBT_PLUGINS_REPO =
  'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases';

export const defaultRegistryUrls = [SBT_PLUGINS_REPO];

export class SbtPluginDatasource extends SbtPackageDatasource {
  static override readonly id = 'sbt-plugin';

  override readonly defaultRegistryUrls = defaultRegistryUrls;

  override readonly registryStrategy = 'hunt';

  override readonly defaultVersioning = ivyVersioning.id;

  constructor() {
    super(SbtPluginDatasource.id);
    this.http = new Http('sbt');
  }

  async resolvePluginReleases(
    rootUrl: string,
    artifact: string,
    scalaVersion: string,
  ): Promise<string[] | null> {
    const searchRoot = `${rootUrl}/${artifact}`;
    const parse = (content: string): string[] =>
      parseIndexDir(content, (x) => !regEx(/^\.+$/).test(x));
    const { body: indexContent } = await downloadHttpProtocol(
      this.http,
      ensureTrailingSlash(searchRoot),
    );
    if (indexContent) {
      const releases: string[] = [];
      const scalaVersionItems = parse(indexContent);
      const scalaVersions = scalaVersionItems.map((x) =>
        x.replace(regEx(/^scala_/), ''),
      );
      const searchVersions = scalaVersions.includes(scalaVersion)
        ? [scalaVersion]
        : scalaVersions;
      for (const searchVersion of searchVersions) {
        const searchSubRoot = `${searchRoot}/scala_${searchVersion}`;
        const { body: subRootContent } = await downloadHttpProtocol(
          this.http,
          ensureTrailingSlash(searchSubRoot),
        );
        if (subRootContent) {
          const sbtVersionItems = parse(subRootContent);
          for (const sbtItem of sbtVersionItems) {
            const releasesRoot = `${searchSubRoot}/${sbtItem}`;
            const { body: releasesIndexContent } = await downloadHttpProtocol(
              this.http,
              ensureTrailingSlash(releasesRoot),
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

  override async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const [groupId, artifactId] = packageName.split(':');
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
      let versions = await this.resolvePluginReleases(
        searchRoot,
        artifact,
        scalaVersion,
      );
      let urls = {};

      if (!versions?.length) {
        const artifactSubdirs = await this.getArtifactSubdirs(
          searchRoot,
          artifact,
          scalaVersion,
        );
        versions = await this.getPackageReleases(searchRoot, artifactSubdirs);
        const latestVersion = getLatestVersion(versions);
        urls = await this.getUrls(searchRoot, artifactSubdirs, latestVersion);
      }

      const dependencyUrl = `${searchRoot}/${artifact}`;

      logger.trace({ dependency: packageName, versions }, `Package versions`);
      if (versions) {
        return {
          ...urls,
          dependencyUrl,
          releases: versions.map((v) => ({ version: v })),
        };
      }
    }

    logger.debug(
      `No versions found for ${packageName} in ${searchRoots.length} repositories`,
    );
    return null;
  }
}
