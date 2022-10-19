// TODO #7154
import URL from 'url';
import { logger } from '../../../../../logger';
import type { Release } from '../../../../../modules/datasource/types';
import * as allVersioning from '../../../../../modules/versioning';
import * as memCache from '../../../../../util/cache/memory';
import * as packageCache from '../../../../../util/cache/package';
import { regEx } from '../../../../../util/regex';
import type { BranchUpgradeConfig } from '../../../../types';
import { slugifyUrl } from './common';
import { getTags } from './gitlab';
import { addReleaseNotes } from './release-notes';
import { getInRangeReleases } from './releases';
import type { ChangeLogRelease, ChangeLogResult } from './types';

const cacheNamespace = 'changelog-gitlab-release';

function getCachedTags(
  endpoint: string,
  versionScheme: string,
  repository: string
): Promise<string[]> {
  const cacheKey = `getTags-${endpoint}-${versionScheme}-${repository}`;
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
  const depName = config.depName!;
  const sourceDirectory = config.sourceDirectory!;

  logger.trace('getChangeLogJSON for gitlab');
  const version = allVersioning.get(versioning);

  const parsedUrl = URL.parse(sourceUrl);
  const protocol = parsedUrl.protocol!;
  const host = parsedUrl.host!;
  const pathname = parsedUrl.pathname!;

  logger.trace({ protocol, host, pathname }, 'Protocol, host, pathname');
  const baseUrl = protocol.concat('//', host, '/');
  const apiBaseUrl = baseUrl.concat('api/v4/');
  const repository = pathname
    .slice(1)
    .replace(regEx(/\/$/), '')
    .replace(regEx(/\.git$/), '');
  if (repository.split('/').length < 2) {
    logger.info({ sourceUrl }, 'Invalid gitlab URL found');
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
    logger.debug('Not enough valid releases');
    return null;
  }

  let tags: string[];

  async function getRef(release: Release): Promise<string | null> {
    if (!tags) {
      tags = await getCachedTags(apiBaseUrl, versioning, repository);
    }
    const regex = regEx(`(?:${depName}|release)[@-]`, undefined, false);
    const tagName = tags
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
      if (!release) {
        release = {
          version: next.version,
          date: next.releaseTimestamp,
          gitRef: next.gitRef,
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

  let res: ChangeLogResult = {
    project: {
      apiBaseUrl,
      baseUrl,
      type: 'gitlab',
      repository,
      sourceUrl,
      depName,
      sourceDirectory,
    },
    versions: changelogReleases,
  };

  res = await addReleaseNotes(res, config);

  return res;
}
