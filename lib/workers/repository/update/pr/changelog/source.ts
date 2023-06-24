import URL from 'node:url';
import is from '@sindresorhus/is';
import { logger } from '../../../../../logger';
import { getPkgReleases } from '../../../../../modules/datasource';
import type { Release } from '../../../../../modules/datasource/types';
import * as allVersioning from '../../../../../modules/versioning';
import * as packageCache from '../../../../../util/cache/package';
import { regEx } from '../../../../../util/regex';
import { trimSlashes } from '../../../../../util/url';
import type { BranchUpgradeConfig } from '../../../../types';
import { slugifyUrl } from './common';
import { addReleaseNotes } from './release-notes';
import { getInRangeReleases } from './releases';
import type {
  ChangeLogError,
  ChangeLogRelease,
  ChangeLogResult,
} from './types';

export abstract class ChangeLogSource {
  private platform;
  private tagsDatasource;
  private cacheNamespace: string;

  constructor(
    platform: 'bitbucket' | 'github' | 'gitlab',
    tagsDatasource: 'bitbucket-tags' | 'github-tags' | 'gitlab-tags'
  ) {
    this.platform = platform;
    this.tagsDatasource = tagsDatasource;
    this.cacheNamespace = `changelog-${platform}-release`;
  }

  abstract getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string
  ): string;

  abstract getAPIBaseUrl(sourceUrl: string): string;

  async getTags(endpoint: string, repository: string): Promise<string[]> {
    const releases = await getPkgReleases({
      datasource: this.tagsDatasource,
      packageName: repository,
    });

    const tags = releases?.releases;

    if (is.nullOrUndefined(tags) || is.emptyArray(tags)) {
      logger.debug(`No Bitbucket tags found for repository:${repository}`);

      return [];
    }

    return tags.map(({ version }) => version);
  }

  public async getChangeLogJSON(
    config: BranchUpgradeConfig
  ): Promise<ChangeLogResult | null> {
    logger.trace(`getChangeLogJSON for ${this.platform}`);

    const versioning = config.versioning!;
    const currentVersion = config.currentVersion!;
    const newVersion = config.newVersion!;
    const sourceUrl = config.sourceUrl!;
    const packageName = config.packageName!;
    const sourceDirectory = config.sourceDirectory!;
    const version = allVersioning.get(versioning);

    if (this.shouldSkipSource(sourceUrl)) {
      return null;
    }

    const baseUrl = this.getBaseUrl(sourceUrl);
    const apiBaseUrl = this.getAPIBaseUrl(sourceUrl);
    const repository = this.getRepositoryFromUrl(sourceUrl);

    const tokenResponse = this.hasValidToken(sourceUrl, config);
    if (!tokenResponse.isValid) {
      if (tokenResponse.error) {
        return {
          error: tokenResponse.error,
        };
      }
      return null;
    }

    if (repository.split('/').length !== 2) {
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
    // compare versions
    const include = (v: string): boolean =>
      version.isGreaterThan(v, currentVersion) &&
      !version.isGreaterThan(v, newVersion);

    for (let i = 1; i < validReleases.length; i += 1) {
      const prev = validReleases[i - 1];
      const next = validReleases[i];
      if (!include(next.version)) {
        continue;
      }
      let release = await packageCache.get(
        this.cacheNamespace,
        this.getCacheKey(sourceUrl, packageName, prev.version, next.version)
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
        const prevHead = await this.getRef(
          version,
          packageName,
          prev,
          apiBaseUrl,
          repository
        );
        const nextHead = await this.getRef(
          version,
          packageName,
          next,
          apiBaseUrl,
          repository
        );
        if (is.nonEmptyString(prevHead) && is.nonEmptyString(nextHead)) {
          release.compare.url = this.getCompareURL(
            baseUrl,
            repository,
            prevHead,
            nextHead
          );
        }
        const cacheMinutes = 55;
        await packageCache.set(
          this.cacheNamespace,
          this.getCacheKey(sourceUrl, packageName, prev.version, next.version),
          release,
          cacheMinutes
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

  protected findTagOfRelease(
    version: allVersioning.VersioningApi,
    packageName: string,
    depNewVersion: string,
    tags: string[]
  ): string | undefined {
    const regex = regEx(`(?:${packageName}|release)[@-]`, undefined, false);
    const tagName = tags
      .filter((tag) => version.isVersion(tag.replace(regex, '')))
      .find((tag) => version.equals(tag.replace(regex, ''), depNewVersion));
    return tagName;
  }

  private async getRef(
    version: allVersioning.VersioningApi,
    packageName: string,
    release: Release,
    apiBaseUrl: string,
    repository: string
  ): Promise<string | null> {
    const tags = await this.getTags(apiBaseUrl, repository);

    const tagName = this.findTagOfRelease(
      version,
      packageName,
      release.version,
      tags
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
    next: string
  ): string {
    return `${slugifyUrl(sourceUrl)}:${packageName}:${prev}:${next}`;
  }

  protected getBaseUrl(sourceUrl: string): string {
    const parsedUrl = URL.parse(sourceUrl);
    const protocol = parsedUrl.protocol!;
    const host = parsedUrl.host!;
    return `${protocol}//${host}/`;
  }

  private getRepositoryFromUrl(sourceUrl: string): string {
    const parsedUrl = URL.parse(sourceUrl);
    const pathname = parsedUrl.pathname!;
    return trimSlashes(pathname).replace(regEx(/\.git$/), '');
  }

  protected hasValidToken(
    sourceUrl: string,
    config: BranchUpgradeConfig
  ): { isValid: boolean; error?: ChangeLogError } {
    return { isValid: true };
  }

  protected shouldSkipSource(sourceUrl: string): boolean {
    return false;
  }
}
