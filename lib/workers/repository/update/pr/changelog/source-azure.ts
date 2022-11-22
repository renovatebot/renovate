import URL from 'url';
import { logger } from '../../../../../logger';
import type { Release } from '../../../../../modules/datasource/types';
import * as allVersioning from '../../../../../modules/versioning';
import * as memCache from '../../../../../util/cache/memory';
import * as packageCache from '../../../../../util/cache/package';
import * as hostRules from '../../../../../util/host-rules';
import { regEx } from '../../../../../util/regex';
import type { BranchUpgradeConfig } from '../../../../types';
import { getTags } from './azure';
import { slugifyUrl } from './common';
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
  const depName = config.depName!;
  const manager = config.manager;
  const version = allVersioning.get(versioning);
  const { protocol, host, pathname } = URL.parse(sourceUrl);
  const organization = pathname!.slice(1).split('/')[0];
  const projectName = pathname!.slice(1).split('/')[1];
  if (!organization || !projectName) {
    logger.warn('invalid source url');
    return null;
  }
  const baseUrl = `${protocol!}//${host!}/${organization}/${projectName}/`;
  const url = sourceUrl;
  const { token } = hostRules.find({
    hostType: 'azure',
    url,
  });
  // istanbul ignore if
  if (!token) {
    if (host === 'dev.azure.com') {
      logger.warn(
        { manager, depName, sourceUrl },
        'No Azure DevOps token has been configured. Skipping release notes retrieval'
      );
      return { error: 'MissingAzureToken' };
    }
    logger.debug(
      { manager, depName, sourceUrl },
      'Repository URL does not match any known Azure DevOps hosts - skipping changelog retrieval'
    );
    return null;
  }
  const repository = pathname!.slice(1).split('/')[3];
  const apiBaseUrl = `${baseUrl}_apis/`;
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
    logger.debug(`Not enough valid releases for dep ${depName}`);
    return null;
  }

  let tags: string[];

  async function getRef(release: Release): Promise<string | null> {
    if (!tags) {
      tags = await getCachedTags(apiBaseUrl, repository);
    }
    const regex = regEx(
      `(?:^refs/tags/)?(?:${depName}|release)?[@-]?`,
      undefined,
      false
    );
    const tagName: string | undefined = tags
      .filter((tag) => version.isVersion(tag.replace(regex, '')))
      .find((tag) => version.equals(tag.replace(regex, ''), release.version));
    if (tagName) {
      return tagName;
    }
    if (release.gitRef) {
      return release.gitRef;
    }
    return null;
  }

  const cacheNamespace = 'changelog-azure-release';

  function getCacheKey(prev: string, next: string): string {
    return `${slugifyUrl(sourceUrl)}:${depName}:${prev}:${next}`;
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
          release.compare.url = `${baseUrl}_git/${repository}/branchCompare?baseVersion=GT${prevHead}&targetVersion=GT${nextHead}`;
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

  let res: ChangeLogResult = {
    project: {
      apiBaseUrl,
      baseUrl,
      type: 'azure',
      repository,
      sourceUrl,
      sourceDirectory,
      depName,
    },
    versions: changelogReleases,
  };

  res = await addReleaseNotes(res, config);

  return res;
}
