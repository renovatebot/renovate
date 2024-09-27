import { logger } from '../../../logger';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import * as ivyVersioning from '../../versioning/ivy';
import { compare } from '../../versioning/maven/compare';
import { MAVEN_REPO } from '../maven/common';
import { downloadHttpProtocol } from '../maven/util';
import { SbtPackageDatasource } from '../sbt-package';
import { extractPageLinks, getLatestVersion } from '../sbt-package/util';
import type {
  GetReleasesConfig,
  RegistryStrategy,
  ReleaseResult,
} from '../types';

export const SBT_PLUGINS_REPO =
  'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases';

export const defaultRegistryUrls = [SBT_PLUGINS_REPO, MAVEN_REPO];

function hrefFilterMap(href: string): string | null {
  return href.startsWith('.') ? null : href;
}

export class SbtPluginDatasource extends SbtPackageDatasource {
  static override readonly id = 'sbt-plugin';

  override readonly defaultRegistryUrls = defaultRegistryUrls;

  override readonly registryStrategy: RegistryStrategy = 'merge';

  override readonly defaultVersioning = ivyVersioning.id;

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `scm` tags in the results.';

  constructor() {
    super(SbtPluginDatasource.id);
    this.http = new Http('sbt');
  }

  async getPluginVersions(
    artifactRoot: string,
    scalaVersion: string,
  ): Promise<string[] | null> {
    const res = await downloadHttpProtocol(
      this.http,
      ensureTrailingSlash(artifactRoot),
    );
    const body = res?.body;
    if (!body) {
      return null;
    }

    const scalaVersions = extractPageLinks(body, hrefFilterMap).map((x) =>
      x.replace(regEx(/^scala_/), ''),
    );
    const searchVersions = scalaVersions.includes(scalaVersion)
      ? [scalaVersion]
      : scalaVersions;

    const allVersions = new Set<string>();
    for (const searchVersion of searchVersions) {
      const searchSubRoot = `${artifactRoot}/scala_${searchVersion}`;
      const subRootRes = await downloadHttpProtocol(
        this.http,
        ensureTrailingSlash(searchSubRoot),
      );
      const subRootContent = subRootRes?.body;
      if (subRootContent) {
        const sbtVersionItems = extractPageLinks(subRootContent, hrefFilterMap);
        for (const sbtItem of sbtVersionItems) {
          const releasesRoot = `${searchSubRoot}/${sbtItem}`;
          const releaseIndexRes = await downloadHttpProtocol(
            this.http,
            ensureTrailingSlash(releasesRoot),
          );
          const releasesIndexContent = releaseIndexRes?.body;
          if (releasesIndexContent) {
            const releasesParsed = extractPageLinks(
              releasesIndexContent,
              hrefFilterMap,
            );

            for (const version of releasesParsed) {
              allVersions.add(version);
            }
          }
        }
      }
    }

    const versions = [...allVersions].sort(compare);
    if (!versions.length) {
      return null;
    }

    return versions;
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
    if (!registryUrl.startsWith(MAVEN_REPO)) {
      searchRoots.push(`${repoRoot}${groupIdSplit.join('.')}`);
    }
    searchRoots.push(`${repoRoot}${groupIdSplit.join('/')}`);

    for (let idx = 0; idx < searchRoots.length; idx += 1) {
      const searchRoot = searchRoots[idx];
      const artifactRoot = `${searchRoot}/${artifact}`;
      let versions = await this.getPluginVersions(artifactRoot, scalaVersion);
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
