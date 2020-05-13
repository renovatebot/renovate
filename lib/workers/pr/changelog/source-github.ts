import URL from 'url';
import { PLATFORM_TYPE_GITHUB } from '../../../constants/platforms';
import { Release } from '../../../datasource';
import { logger } from '../../../logger';
import { api } from '../../../platform/github/gh-got-wrapper';
import * as globalCache from '../../../util/cache/global';
import * as hostRules from '../../../util/host-rules';
import * as allVersioning from '../../../versioning';
import { BranchUpgradeConfig } from '../../common';
import { ChangeLogError, ChangeLogRelease, ChangeLogResult } from './common';
import { addReleaseNotes } from './release-notes';

const { get: ghGot } = api;

async function getTags(
  endpoint: string,
  repository: string
): Promise<string[]> {
  const url = `${endpoint}repos/${repository}/tags?per_page=100`;
  try {
    const res = await ghGot<{ name: string }[]>(url, {
      paginate: true,
    });

    const tags = (res && res.body) || [];

    if (!tags.length) {
      logger.debug({ repository }, 'repository has no Github tags');
    }

    return tags.map((tag) => tag.name).filter(Boolean);
  } catch (err) {
    logger.debug({ sourceRepo: repository }, 'Failed to fetch Github tags');
    logger.debug({ err });
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
  if (sourceUrl === 'https://github.com/DefinitelyTyped/DefinitelyTyped') {
    logger.debug('No release notes for @types');
    return null;
  }
  const version = allVersioning.get(versioning);
  const { protocol, host, pathname } = URL.parse(sourceUrl);
  const baseUrl = `${protocol}//${host}/`;
  const url = sourceUrl.startsWith('https://github.com/')
    ? 'https://api.github.com/'
    : sourceUrl;
  const config = hostRules.find({
    hostType: PLATFORM_TYPE_GITHUB,
    url,
  });
  // istanbul ignore if
  if (!config.token) {
    if (host.endsWith('github.com')) {
      logger.warn(
        { manager, depName, sourceUrl },
        'No github.com token has been configured. Skipping release notes retrieval'
      );
      return { error: ChangeLogError.MissingGithubToken };
    }
    logger.debug(
      { manager, depName, sourceUrl },
      'Repository URL does not match any known hosts - skipping changelog retrieval'
    );
    return null;
  }
  const apiBaseUrl = sourceUrl.startsWith('https://github.com/')
    ? 'https://api.github.com/'
    : baseUrl;
  const repository = pathname.slice(1).replace(/\/$/, '');
  if (repository.split('/').length !== 2) {
    logger.debug({ sourceUrl }, 'Invalid github URL found');
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
      tags = await getTags(apiBaseUrl, repository);
    }
    const regex = new RegExp(`${depName}[@-]`);
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

  const cacheNamespace = 'changelog-github-release';
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
      // istanbul ignore else
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
      github: repository,
      repository: sourceUrl,
      depName,
    },
    versions: changelogReleases,
  };

  res = await addReleaseNotes(res);

  return res;
}
