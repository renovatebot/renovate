import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import pAll from 'p-all';
import type { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import { newlineRegex, regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import mavenVersion from '../../versioning/maven';
import * as mavenVersioning from '../../versioning/maven';
import { compare } from '../../versioning/maven/compare';
import { Datasource } from '../datasource';
import type {
  GetReleasesConfig,
  RegistryStrategy,
  Release,
  ReleaseResult,
} from '../types';
import { MAVEN_REPO } from './common';
import type { MavenDependency, ReleaseMap } from './types';
import {
  checkResource,
  createUrlForDependencyPom,
  downloadHttpProtocol,
  downloadMavenXml,
  getDependencyInfo,
  getDependencyParts,
  getMavenUrl,
} from './util';

function getLatestSuitableVersion(releases: Release[]): string | null {
  // istanbul ignore if
  if (!releases?.length) {
    return null;
  }
  const allVersions = releases.map(({ version }) => version);
  const stableVersions = allVersions.filter((x) => mavenVersion.isStable(x));
  const versions = stableVersions.length ? stableVersions : allVersions;
  return versions.reduce((latestVersion, version) =>
    compare(version, latestVersion) === 1
      ? version
      : /* istanbul ignore next: hard to test */ latestVersion
  );
}

function extractVersions(metadata: XmlDocument): string[] {
  const versions = metadata.descendantWithPath('versioning.versions');
  const elements = versions?.childrenNamed('version');
  if (!elements) {
    return [];
  }
  return elements.map((el) => el.val);
}

const mavenCentralHtmlVersionRegex = regEx(
  '^<a href="(?<version>[^"]+)\\/" title="(?:[^"]+)\\/">(?:[^"]+)\\/<\\/a>\\s+(?<releaseTimestamp>\\d\\d\\d\\d-\\d\\d-\\d\\d \\d\\d:\\d\\d)\\s+-$',
  'i'
);

export const defaultRegistryUrls = [MAVEN_REPO];

export class MavenDatasource extends Datasource {
  static id = 'maven';

  override readonly defaultRegistryUrls = defaultRegistryUrls;

  override readonly defaultVersioning: string = mavenVersioning.id;

  override readonly registryStrategy: RegistryStrategy = 'merge';

  constructor(id = MavenDatasource.id) {
    super(id);
  }

  async fetchReleasesFromMetadata(
    dependency: MavenDependency,
    repoUrl: string
  ): Promise<ReleaseMap> {
    const metadataUrl = getMavenUrl(dependency, repoUrl, 'maven-metadata.xml');

    const cacheNamespace = 'datasource-maven:metadata-xml';
    const cacheKey = metadataUrl.toString();
    const cachedVersions = await packageCache.get<ReleaseMap>(
      cacheNamespace,
      cacheKey
    );
    /* istanbul ignore if */
    if (cachedVersions) {
      return cachedVersions;
    }

    const { isCacheable, xml: mavenMetadata } = await downloadMavenXml(
      this.http,
      metadataUrl
    );
    if (!mavenMetadata) {
      return {};
    }

    const versions = extractVersions(mavenMetadata);
    const releaseMap = versions.reduce(
      (acc, version) => ({ ...acc, [version]: null }),
      {}
    );
    if (isCacheable) {
      await packageCache.set(cacheNamespace, cacheKey, releaseMap, 30);
    }
    return releaseMap;
  }

  async addReleasesFromIndexPage(
    inputReleaseMap: ReleaseMap,
    dependency: MavenDependency,
    repoUrl: string
  ): Promise<ReleaseMap> {
    const cacheNs = 'datasource-maven:index-html-releases';
    const cacheKey = `${repoUrl}${dependency.dependencyUrl}`;
    let workingReleaseMap = await packageCache.get<ReleaseMap>(
      cacheNs,
      cacheKey
    );
    if (!workingReleaseMap) {
      workingReleaseMap = {};
      let retryEarlier = false;
      try {
        if (repoUrl.startsWith(MAVEN_REPO)) {
          const indexUrl = getMavenUrl(dependency, repoUrl, 'index.html');
          const res = await downloadHttpProtocol(this.http, indexUrl);
          const { body = '' } = res;
          for (const line of body.split(newlineRegex)) {
            const match = line.trim().match(mavenCentralHtmlVersionRegex);
            if (match) {
              const { version, releaseTimestamp: timestamp } =
                match?.groups ?? /* istanbul ignore next: hard to test */ {};
              if (version && timestamp) {
                const date = DateTime.fromFormat(
                  timestamp,
                  'yyyy-MM-dd HH:mm',
                  {
                    zone: 'UTC',
                  }
                );
                if (date.isValid) {
                  const releaseTimestamp = date.toISO();
                  workingReleaseMap[version] = { version, releaseTimestamp };
                }
              }
            }
          }
        }
      } catch (err) /* istanbul ignore next */ {
        retryEarlier = true;
        logger.debug(
          { dependency, err },
          'Failed to get releases from index.html'
        );
      }
      const cacheTTL = retryEarlier
        ? /* istanbul ignore next: hard to test */ 60
        : 24 * 60;
      await packageCache.set(cacheNs, cacheKey, workingReleaseMap, cacheTTL);
    }

    const releaseMap = { ...inputReleaseMap };
    for (const version of Object.keys(releaseMap)) {
      releaseMap[version] ||= workingReleaseMap[version] ?? null;
    }

    return releaseMap;
  }

  /**
   *
   * Double-check releases using HEAD request and
   * attach timestamps obtained from `Last-Modified` header.
   *
   * Example input:
   *
   * {
   *   '1.0.0': {
   *     version: '1.0.0',
   *     releaseTimestamp: '2020-01-01T01:00:00.000Z',
   *   },
   *   '1.0.1': null,
   * }
   *
   * Example output:
   *
   * {
   *   '1.0.0': {
   *     version: '1.0.0',
   *     releaseTimestamp: '2020-01-01T01:00:00.000Z',
   *   },
   *   '1.0.1': {
   *     version: '1.0.1',
   *     releaseTimestamp: '2021-01-01T01:00:00.000Z',
   *   }
   * }
   *
   * It should validate `1.0.0` with HEAD request, but leave `1.0.1` intact.
   *
   */
  async addReleasesUsingHeadRequests(
    inputReleaseMap: ReleaseMap,
    dependency: MavenDependency,
    repoUrl: string
  ): Promise<ReleaseMap> {
    const releaseMap = { ...inputReleaseMap };

    if (process.env.RENOVATE_EXPERIMENTAL_NO_MAVEN_POM_CHECK) {
      return releaseMap;
    }

    const cacheNs = 'datasource-maven:head-requests';
    const cacheTimeoutNs = 'datasource-maven:head-requests-timeout';
    const cacheKey = `${repoUrl}${dependency.dependencyUrl}`;

    // Store cache validity as the separate flag.
    // This allows both cache updating and resetting.
    //
    // Even if new version is being released each 10 minutes,
    // we still want to reset the whole cache after 24 hours.
    const isCacheValid = await packageCache.get<true>(cacheTimeoutNs, cacheKey);

    let cachedReleaseMap: ReleaseMap = {};
    // istanbul ignore if
    if (isCacheValid) {
      const cache = await packageCache.get<ReleaseMap>(cacheNs, cacheKey);
      if (cache) {
        cachedReleaseMap = cache;
      }
    }

    // List versions to check with HEAD request
    const freshVersions = Object.entries(releaseMap)
      .filter(([version, release]) => {
        // Release is present in maven-metadata.xml,
        // but haven't been validated yet
        const isValidatedAtPreviousSteps = release !== null;

        // Release was validated and cached with HEAD request during previous run
        const isValidatedHere = !is.undefined(cachedReleaseMap[version]);

        // Select only valid releases not yet verified with HEAD request
        return !isValidatedAtPreviousSteps && !isValidatedHere;
      })
      .map(([k]) => k);

    // Update cached data with freshly discovered versions
    if (freshVersions.length) {
      const queue = freshVersions.map((version) => async (): Promise<void> => {
        const pomUrl = await createUrlForDependencyPom(
          this.http,
          version,
          dependency,
          repoUrl
        );
        const artifactUrl = getMavenUrl(dependency, repoUrl, pomUrl);
        const release: Release = { version };

        const res = await checkResource(this.http, artifactUrl);

        if (is.date(res)) {
          release.releaseTimestamp = res.toISOString();
        }

        cachedReleaseMap[version] =
          res !== 'not-found' && res !== 'error' ? release : null;
      });

      await pAll(queue, { concurrency: 5 });

      if (!isCacheValid) {
        // Store new TTL flag for 24 hours if the previous one is invalidated
        await packageCache.set(cacheTimeoutNs, cacheKey, 'long', 24 * 60);
      }

      // Store updated cache object
      await packageCache.set(cacheNs, cacheKey, cachedReleaseMap, 24 * 60);
    }

    // Filter releases with the versions validated via HEAD request
    for (const version of Object.keys(releaseMap)) {
      releaseMap[version] = cachedReleaseMap[version] ?? null;
    }
    return releaseMap;
  }

  getReleasesFromMap(releaseMap: ReleaseMap): Release[] {
    const releases = Object.values(releaseMap).filter(is.truthy);
    if (releases.length) {
      return releases;
    }
    return Object.keys(releaseMap).map((version) => ({ version }));
  }

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const dependency = getDependencyParts(packageName);
    const repoUrl = ensureTrailingSlash(registryUrl);

    logger.debug(`Looking up ${dependency.display} in repository ${repoUrl}`);

    let releaseMap = await this.fetchReleasesFromMetadata(dependency, repoUrl);
    releaseMap = await this.addReleasesFromIndexPage(
      releaseMap,
      dependency,
      repoUrl
    );
    releaseMap = await this.addReleasesUsingHeadRequests(
      releaseMap,
      dependency,
      repoUrl
    );
    const releases = this.getReleasesFromMap(releaseMap);
    if (!releases?.length) {
      return null;
    }

    logger.debug(
      `Found ${releases.length} new releases for ${dependency.display} in repository ${repoUrl}`
    );

    const latestSuitableVersion = getLatestSuitableVersion(releases);
    const dependencyInfo =
      latestSuitableVersion &&
      (await getDependencyInfo(
        this.http,
        dependency,
        repoUrl,
        latestSuitableVersion
      ));

    return { ...dependency, ...dependencyInfo, releases };
  }
}
