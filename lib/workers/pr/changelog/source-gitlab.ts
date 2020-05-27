import URL from 'url';
import { Release } from '../../../datasource';
import { logger } from '../../../logger';
import { api } from '../../../platform/gitlab/gl-got-wrapper';
import * as globalCache from '../../../util/cache/global';
import { regEx } from '../../../util/regex';
import * as allVersioning from '../../../versioning';
import { BranchUpgradeConfig } from '../../common';
import { ChangeLogRelease, ChangeLogResult } from './common';
import { addReleaseNotes } from './release-notes';

const { get: glGot } = api;

const cacheNamespace = 'changelog-gitlab-release';

async function getTags(
  endpoint: string,
  versionScheme: string,
  repository: string
): Promise<string[]> {
  logger.trace('getTags() from gitlab');
  let url = endpoint;
  const repoid = repository.replace(/\//g, '%2F');
  url += `projects/${repoid}/repository/tags`;
  try {
    const res = await glGot<{ name: string }[]>(url, {
      paginate: true,
    });

    const tags = (res && res.body) || [];

    if (!tags.length) {
      logger.debug({ sourceRepo: repository }, 'repository has no Gitlab tags');
    }

    return tags.map((tag) => tag.name).filter(Boolean);
  } catch (err) {
    logger.info({ sourceRepo: repository }, 'Failed to fetch Gitlab tags');
    // istanbul ignore if
    if (err.message && err.message.includes('Bad credentials')) {
      logger.warn('Bad credentials triggering tag fail lookup in changelog');
      throw err;
    }
    return [];
  }
}

export async function getChangeLogJSON({
  versioning,
  fromVersion,
  toVersion,
  sourceUrl,
  releases,
  depName,
  manager,
}: BranchUpgradeConfig): Promise<ChangeLogResult | null> {
  logger.trace('getChangeLogJSON for gitlab');
  const version = allVersioning.get(versioning);
  const { protocol, host, pathname } = URL.parse(sourceUrl);
  logger.trace({ protocol, host, pathname }, 'Protocol, host, pathname');
  const baseUrl = protocol.concat('//', host, '/');
  const apiBaseUrl = baseUrl.concat('api/v4/');
  const repository = pathname
    .slice(1)
    .replace(/\/$/, '')
    .replace(/\.git$/, '');
  if (repository.split('/').length < 2) {
    logger.info({ sourceUrl }, 'Invalid gitlab URL found');
    return null;
  }
  if (!(releases && releases.length)) {
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
      tags = await getTags(apiBaseUrl, versioning, repository);
    }
    const regex = regEx(`${depName}[@-]`);
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
    return `${manager}:${depName}:${prev}:${next}`;
  }

  const changelogReleases: ChangeLogRelease[] = [];
  // compare versions
  const include = (v: string): boolean =>
    version.isGreaterThan(v, fromVersion) &&
    !version.isGreaterThan(v, toVersion);
  for (let i = 1; i < validReleases.length; i += 1) {
    const prev = validReleases[i - 1];
    const next = validReleases[i];
    if (include(next.version)) {
      let release = await globalCache.get(
        cacheNamespace,
        getCacheKey(prev.version, next.version)
      );
      if (!release) {
        release = {
          version: next.version,
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
        await globalCache.set(
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
      gitlab: repository,
      repository: sourceUrl,
      depName,
    },
    versions: changelogReleases,
  };

  res = await addReleaseNotes(res);

  return res;
}
