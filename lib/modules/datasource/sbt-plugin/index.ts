import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import * as ivyVersioning from '../../versioning/ivy';
import { compare } from '../../versioning/maven/compare';
import { Datasource } from '../datasource';
import { MAVEN_REPO } from '../maven/common';
import { downloadHttpContent } from '../maven/util';
import { extractPageLinks, getLatestVersion } from '../sbt-package/util';
import type {
  GetReleasesConfig,
  RegistryStrategy,
  ReleaseResult,
} from '../types';

export const SBT_PLUGINS_REPO =
  'https://repo.scala-sbt.org/scalasbt/sbt-plugin-releases';

export class SbtPluginDatasource extends Datasource {
  static readonly id = 'sbt-plugin';

  override readonly defaultRegistryUrls = [SBT_PLUGINS_REPO, MAVEN_REPO];

  override readonly defaultVersioning = ivyVersioning.id;

  override readonly registryStrategy: RegistryStrategy = 'merge';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `scm` tags in the results.';

  constructor() {
    super(SbtPluginDatasource.id);
    this.http = new Http('sbt');
  }

  // istanbul ignore next: to be rewritten
  async getArtifactSubdirs(
    searchRoot: string,
    artifact: string,
    scalaVersion: string,
  ): Promise<string[] | null> {
    const pkgUrl = ensureTrailingSlash(searchRoot);
    const indexContent = await downloadHttpContent(this.http, pkgUrl);
    if (indexContent) {
      const rootPath = new URL(pkgUrl).pathname;
      let artifactSubdirs = extractPageLinks(indexContent, (href) => {
        const path = href.replace(rootPath, '');
        if (
          path.startsWith(`${artifact}_native`) ||
          path.startsWith(`${artifact}_sjs`)
        ) {
          return null;
        }

        if (path === artifact || path.startsWith(`${artifact}_`)) {
          return path;
        }

        return null;
      });

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

  // istanbul ignore next: to be rewritten
  async getPackageReleases(
    searchRoot: string,
    artifactSubdirs: string[] | null,
  ): Promise<string[] | null> {
    if (artifactSubdirs) {
      const releases: string[] = [];
      for (const searchSubdir of artifactSubdirs) {
        const pkgUrl = ensureTrailingSlash(`${searchRoot}/${searchSubdir}`);
        const content = await downloadHttpContent(this.http, pkgUrl);
        if (content) {
          const rootPath = new URL(pkgUrl).pathname;
          const subdirReleases = extractPageLinks(content, (href) => {
            const path = href.replace(rootPath, '');
            if (path.startsWith('.')) {
              return null;
            }

            return path;
          });

          subdirReleases.forEach((x) => releases.push(x));
        }
      }
      if (releases.length) {
        return [...new Set(releases)].sort(compare);
      }
    }

    return null;
  }

  // istanbul ignore next: to be rewritten
  async getUrls(
    searchRoot: string,
    artifactDirs: string[] | null,
    version: string | null,
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
      const pomFileNames = [
        `${artifactDir}-${version}.pom`,
        `${artifact}-${version}.pom`,
      ];

      for (const pomFileName of pomFileNames) {
        const pomUrl = `${searchRoot}/${artifactDir}/${version}/${pomFileName}`;
        const content = await downloadHttpContent(this.http, pomUrl);
        if (content) {
          const pomXml = new XmlDocument(content);

          const homepage = pomXml.valueWithPath('url');
          if (homepage) {
            result.homepage = homepage;
          }

          const sourceUrl = pomXml.valueWithPath('scm.url');
          if (sourceUrl) {
            result.sourceUrl = sourceUrl
              .replace(regEx(/^scm:/), '')
              .replace(regEx(/^git:/), '')
              .replace(regEx(/^git@github.com:/), 'https://github.com/')
              .replace(regEx(/\.git$/), '');
          }

          return result;
        }
      }
    }

    return result;
  }

  async resolvePluginReleases(
    rootUrl: string,
    artifact: string,
    scalaVersion: string,
  ): Promise<string[] | null> {
    const searchRoot = `${rootUrl}/${artifact}`;
    const hrefFilterMap = (href: string): string | null => {
      if (href.startsWith('.')) {
        return null;
      }

      return href;
    };
    const searchRootContent = await downloadHttpContent(
      this.http,
      ensureTrailingSlash(searchRoot),
    );
    if (searchRootContent) {
      const releases: string[] = [];
      const scalaVersionItems = extractPageLinks(
        searchRootContent,
        hrefFilterMap,
      );
      const scalaVersions = scalaVersionItems.map((x) =>
        x.replace(regEx(/^scala_/), ''),
      );
      const searchVersions = scalaVersions.includes(scalaVersion)
        ? [scalaVersion]
        : scalaVersions;
      for (const searchVersion of searchVersions) {
        const searchSubRoot = `${searchRoot}/scala_${searchVersion}`;
        const subRootContent = await downloadHttpContent(
          this.http,
          ensureTrailingSlash(searchSubRoot),
        );
        if (subRootContent) {
          const sbtVersionItems = extractPageLinks(
            subRootContent,
            hrefFilterMap,
          );
          for (const sbtItem of sbtVersionItems) {
            const releasesRoot = `${searchSubRoot}/${sbtItem}`;
            const releasesIndexContent = await downloadHttpContent(
              this.http,
              ensureTrailingSlash(releasesRoot),
            );
            if (releasesIndexContent) {
              const releasesParsed = extractPageLinks(
                releasesIndexContent,
                hrefFilterMap,
              );
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
    if (!registryUrl.startsWith(MAVEN_REPO)) {
      searchRoots.push(`${repoRoot}${groupIdSplit.join('.')}`);
    }
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
