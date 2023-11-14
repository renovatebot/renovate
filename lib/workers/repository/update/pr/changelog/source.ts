import is from '@sindresorhus/is';
import { logger } from '../../../../../logger';
import { getPkgReleases } from '../../../../../modules/datasource';
import type { Release } from '../../../../../modules/datasource/types';
import * as allVersioning from '../../../../../modules/versioning';
import * as packageCache from '../../../../../util/cache/package';
import { memoize } from '../../../../../util/memoize';
import { regEx } from '../../../../../util/regex';
import { parseUrl, trimSlashes } from '../../../../../util/url';
import type { BranchUpgradeConfig } from '../../../../types';
import { slugifyUrl } from './common';
import { addReleaseNotes } from './release-notes';
import { getInRangeReleases } from './releases';
import type {
  ChangeLogError,
  ChangeLogPlatform,
  ChangeLogRelease,
  ChangeLogResult,
} from './types';

export abstract class ChangeLogSource {
  private readonly cacheNamespace: string;

  constructor(
    private readonly platform: ChangeLogPlatform,
    private readonly datasource:
      | 'bitbucket-tags'
      | 'gitea-tags'
      | 'github-tags'
      | 'gitlab-tags',
  ) {
    this.cacheNamespace = `changelog-${platform}-release`;
  }

  abstract getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string;

  abstract getAPIBaseUrl(config: BranchUpgradeConfig): string;

  async getAllTags(endpoint: string, repository: string): Promise<string[]> {
    const tags = (
      await getPkgReleases({
        registryUrls: [endpoint],
        datasource: this.datasource,
        packageName: repository,
        versioning:
          'regex:(?<major>\\d+)(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?',
      })
    )?.releases;

    if (is.nullOrUndefined(tags) || is.emptyArray(tags)) {
      logger.debug(
        `No ${this.datasource} tags found for repository: ${repository}`,
      );

      return [];
    }

    return tags.map(({ version }) => version);
  }

  public async getChangeLogJSON(
    config: BranchUpgradeConfig,
  ): Promise<ChangeLogResult | null> {
    logger.trace(`getChangeLogJSON for ${this.platform}`);

    const versioning = config.versioning!;
    const currentVersion = config.currentVersion!;
    const newVersion = config.newVersion!;
    const sourceUrl = config.sourceUrl!;
    const packageName = config.packageName!;
    const sourceDirectory = config.sourceDirectory;
    const version = allVersioning.get(versioning);

    if (this.shouldSkipPackage(config)) {
      return null;
    }

    const baseUrl = this.getBaseUrl(config);
    const apiBaseUrl = this.getAPIBaseUrl(config);
    const repository = this.getRepositoryFromUrl(config);

    const tokenResponse = this.hasValidToken(config);
    if (!tokenResponse.isValid) {
      if (tokenResponse.error) {
        return {
          error: tokenResponse.error,
        };
      }
      return null;
    }

    if (is.falsy(this.hasValidRepository(repository))) {
      logger.debug(`Invalid ${this.platform} URL found: ${sourceUrl}`);
      return null;
    }

    const releases = config.releases ?? (await getInRangeReleases(config));
    if (!releases?.length) {
      logger.debug('No releases');
      return null;
    }
    // This extra filter/sort should not be necessary, but better safe than sorry
    const validReleases = [...releases]
      .filter((release) => version.isVersion(release.version))
      .sort((a, b) => version.sortVersions(a.version, b.version));

    if (validReleases.length < 2) {
      logger.debug(`Not enough valid releases for dep ${packageName}`);
      return null;
    }

    const changelogReleases: ChangeLogRelease[] = [];

    // Check if `v` belongs to the range (currentVersion, newVersion]
    const inRange = (v: string): boolean =>
      version.isGreaterThan(v, currentVersion) &&
      !version.isGreaterThan(v, newVersion);

    const getTags = memoize(() => this.getAllTags(apiBaseUrl, repository));
    for (let i = 1; i < validReleases.length; i += 1) {
      const prev = validReleases[i - 1];
      const next = validReleases[i];
      if (!inRange(next.version)) {
        continue;
      }
      let release = await packageCache.get(
        this.cacheNamespace,
        this.getCacheKey(sourceUrl, packageName, prev.version, next.version),
      );
      if (!release) {
        release = {
          version: next.version,
          date: next.releaseTimestamp,
          gitRef: next.gitRef,
          // put empty changes so that existing templates won't break
          changes: [],
          compare: {},
        };
        const tags = await getTags();
        const prevHead = this.getRef(version, packageName, prev, tags);
        const nextHead = this.getRef(version, packageName, next, tags);
        if (is.nonEmptyString(prevHead) && is.nonEmptyString(nextHead)) {
          release.compare.url = this.getCompareURL(
            baseUrl,
            repository,
            prevHead,
            nextHead,
          );
        }
        const cacheMinutes = 55;
        await packageCache.set(
          this.cacheNamespace,
          this.getCacheKey(sourceUrl, packageName, prev.version, next.version),
          release,
          cacheMinutes,
        );
      }
      changelogReleases.unshift(release);
    }

    let res: ChangeLogResult | null = {
      project: {
        apiBaseUrl,
        baseUrl,
        type: this.platform,
        repository,
        sourceUrl,
        sourceDirectory,
        packageName,
      },
      versions: changelogReleases,
    };

    res = await addReleaseNotes(res, config);

    return res;
  }

  private findTagOfRelease(
    version: allVersioning.VersioningApi,
    packageName: string,
    depNewVersion: string,
    tags: string[],
  ): string | undefined {
    const regex = regEx(`(?:${packageName}|release)[@-]`, undefined, false);
    const exactReleaseRegex = regEx(`${packageName}[@\\-_]v?${depNewVersion}`);
    const exactTagsList = tags.filter((tag) => {
      return exactReleaseRegex.test(tag);
    });
    const tagList = exactTagsList.length ? exactTagsList : tags;
    return tagList
      .filter((tag) => version.isVersion(tag.replace(regex, '')))
      .find((tag) => version.equals(tag.replace(regex, ''), depNewVersion));
  }

  private getRef(
    version: allVersioning.VersioningApi,
    packageName: string,
    release: Release,
    tags: string[],
  ): string | null {
    const tagName = this.findTagOfRelease(
      version,
      packageName,
      release.version,
      tags,
    );
    if (is.nonEmptyString(tagName)) {
      return tagName;
    }
    if (is.nonEmptyString(release.gitRef)) {
      return release.gitRef;
    }
    return null;
  }

  private getCacheKey(
    sourceUrl: string,
    packageName: string,
    prev: string,
    next: string,
  ): string {
    return `${slugifyUrl(sourceUrl)}:${packageName}:${prev}:${next}`;
  }

  getBaseUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = parseUrl(config.sourceUrl);
    if (is.nullOrUndefined(parsedUrl)) {
      return '';
    }
    const protocol = parsedUrl.protocol.replace(regEx(/^git\+/), '');
    const host = parsedUrl.host;
    return `${protocol}//${host}/`;
  }

  getRepositoryFromUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = parseUrl(config.sourceUrl);
    if (is.nullOrUndefined(parsedUrl)) {
      return '';
    }
    const pathname = parsedUrl.pathname;
    return trimSlashes(pathname).replace(regEx(/\.git$/), '');
  }

  protected hasValidToken(config: BranchUpgradeConfig): {
    isValid: boolean;
    error?: ChangeLogError;
  } {
    return { isValid: true };
  }

  protected shouldSkipPackage(config: BranchUpgradeConfig): boolean {
    return false;
  }

  hasValidRepository(repository: string): boolean {
    return repository.split('/').length === 2;
  }
}
