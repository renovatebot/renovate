// TODO #7154
import URL from 'node:url';
import { GlobalConfig } from '../../../../../config/global';
import { logger } from '../../../../../logger';
import type { Release } from '../../../../../modules/datasource/types';
import * as allVersioning from '../../../../../modules/versioning';
import * as memCache from '../../../../../util/cache/memory';
import * as packageCache from '../../../../../util/cache/package';
import * as hostRules from '../../../../../util/host-rules';
import { regEx } from '../../../../../util/regex';
import type { BranchUpgradeConfig } from '../../../../types';
import { slugifyUrl } from './common';
import { getTags } from './github';
import { addReleaseNotes } from './release-notes';
import { getInRangeReleases } from './releases';
import type { ChangeLogRelease, ChangeLogResult } from './types';

function getCachedTags(
  endpoint: string,
  repository: string
): Promise<string[]> {
  const cacheKey = `getTags-${endpoint}-${repository}`;
  const cachedResult = memCache.get<Promise<string[]>>(cacheKey);
  // istanbul ignore if
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  const promisedRes = getTags(endpoint, repository);
  memCache.set(cacheKey, promisedRes);
  return promisedRes;
}

export async function getChangeLogJSON(
  config: BranchUpgradeConfig
): Promise<ChangeLogResult | null> {
  const versioning = config.versioning!;
  const currentVersion = config.currentVersion!;
  const newVersion = config.newVersion!;
  const sourceUrl = config.sourceUrl!;
  const sourceDirectory = config.sourceDirectory!;
  const packageName = config.packageName!;
  const manager = config.manager;
  if (sourceUrl === 'https://github.com/DefinitelyTyped/DefinitelyTyped') {
    logger.trace('No release notes for @types');
    return null;
  }
  const version = allVersioning.get(versioning);
  const { protocol, host, pathname } = URL.parse(sourceUrl);
  // TODO: types (#7154)
  const baseUrl = `${protocol!}//${host!}/`;
  const url = sourceUrl.startsWith('https://github.com/')
    ? 'https://api.github.com/'
    : sourceUrl;
  const { token } = hostRules.find({
    hostType: 'github',
    url,
  });
  // istanbul ignore if
  if (!token) {
    if (host!.endsWith('.github.com') || host === 'github.com') {
      if (!GlobalConfig.get('githubTokenWarn')) {
        logger.debug(
          { manager, packageName, sourceUrl },
          'GitHub token warning has been suppressed. Skipping release notes retrieval'
        );
        return null;
      }
      logger.warn(
        { manager, packageName, sourceUrl },
        'No github.com token has been configured. Skipping release notes retrieval'
      );
      return { error: 'MissingGithubToken' };
    }
    logger.debug(
      { manager, packageName, sourceUrl },
      'Repository URL does not match any known github hosts - skipping changelog retrieval'
    );
    return null;
  }
  const apiBaseUrl = sourceUrl.startsWith('https://github.com/')
    ? 'https://api.github.com/'
    : baseUrl + 'api/v3/';
  const repository = pathname!
    .slice(1)
    .replace(regEx(/\/$/), '')
    .replace(regEx(/\.git$/), '');
  if (repository.split('/').length !== 2) {
    logger.debug(`Invalid github URL found: ${sourceUrl}`);
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

  let tags: string[];

  async function getRef(release: Release): Promise<string | null> {
    if (!tags) {
      tags = await getCachedTags(apiBaseUrl, repository);
    }
    const tagName = findTagOfRelease(
      version,
      packageName,
      release.version,
      tags
    );
    if (tagName) {
      return tagName;
    }
    if (release.gitRef) {
      return release.gitRef;
    }
    return null;
  }

  const cacheNamespace = 'changelog-github-release';

  function getCacheKey(prev: string, next: string): string {
    return `${slugifyUrl(sourceUrl)}:${packageName}:${prev}:${next}`;
  }

  const changelogReleases: ChangeLogRelease[] = [];
  // compare versions
  const include = (v: string): boolean =>
    version.isGreaterThan(v, currentVersion) &&
    !version.isGreaterThan(v, newVersion);
  for (let i = 1; i < validReleases.length; i += 1) {
    const prev = validReleases[i - 1];
    const next = validReleases[i];
    if (include(next.version)) {
      let release = await packageCache.get(
        cacheNamespace,
        getCacheKey(prev.version, next.version)
      );
      // istanbul ignore else
      if (!release) {
        release = {
          version: next.version,
          gitRef: next.gitRef,
          date: next.releaseTimestamp,
          // put empty changes so that existing templates won't break
          changes: [],
          compare: {},
        };
        const prevHead = await getRef(prev);
        const nextHead = await getRef(next);
        if (prevHead && nextHead) {
          release.compare.url = `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
        }
        const cacheMinutes = 55;
        await packageCache.set(
          cacheNamespace,
          getCacheKey(prev.version, next.version),
          release,
          cacheMinutes
        );
      }
      changelogReleases.unshift(release);
    }
  }

  let res: ChangeLogResult | null = {
    project: {
      apiBaseUrl,
      baseUrl,
      type: 'github',
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

function findTagOfRelease(
  version: allVersioning.VersioningApi,
  packageName: string,
  depNewVersion: string,
  tags: string[]
): string | undefined {
  const regex = regEx(`(?:${packageName}|release)[@-]`, undefined, false);
  const exactReleaseRegex = regEx(`${packageName}[@\\-_]v?${depNewVersion}`);
  const exactTagsList = tags.filter((tag) => {
    return exactReleaseRegex.test(tag);
  });
  let tagName: string | undefined;
  if (exactTagsList.length) {
    tagName = exactTagsList
      .filter((tag) => version.isVersion(tag.replace(regex, '')))
      .find((tag) => version.equals(tag.replace(regex, ''), depNewVersion));
  } else {
    tagName = tags
      .filter((tag) => version.isVersion(tag.replace(regex, '')))
      .find((tag) => version.equals(tag.replace(regex, ''), depNewVersion));
  }
  return tagName;
}
