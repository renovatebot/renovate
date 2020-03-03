import URL from 'url';
import { api } from '../../../platform/github/gh-got-wrapper';
import { logger } from '../../../logger';
import * as hostRules from '../../../util/host-rules';
import * as versioning from '../../../versioning';
import { addReleaseNotes } from './release-notes';
import {
  ChangeLogConfig,
  ChangeLogError,
  ChangeLogRelease,
  ChangeLogResult,
} from './common';
import { Release } from '../../../datasource';
import { PLATFORM_TYPE_GITLAB } from '../../../constants/platforms';

const { get: ghGot } = api;

async function getTags(
  endpoint: string,
  versionScheme: string,
  repository: string
): Promise<string[]> {
  logger.trace('getTags() from gitlab');
  let url = endpoint
    ? endpoint.replace(/\/?$/, '/')
    : /* istanbul ignore next: not possible to test, maybe never possible? */ 'https://gitlab.com/api/v4/';
  const repoid = repository.replace(/\.git/, '').replace(/\//, '%2F');
  url += `projects/${repoid}/repository/tags`;
  try {
    const res = await ghGot<{ name: string }[]>(url, {
      paginate: true,
    });

    const tags = (res && res.body) || [];

    if (!tags.length) {
      logger.debug({ repoid }, 'repository has no Gitlab tags');
    }

    return tags.map(tag => tag.name).filter(Boolean);
  } catch (err) {
    logger.info({ sourceRepo: repoid }, 'Failed to fetch Gitlab tags');
    // istanbul ignore if
    if (err.message && err.message.includes('Bad credentials')) {
      logger.warn('Bad credentials triggering tag fail lookup in changelog');
      throw err;
    }
    return [];
  }
}

export async function getChangeLogJSON({
  endpoint,
  versionScheme,
  fromVersion,
  toVersion,
  sourceUrl,
  releases,
  depName,
  manager,
}: ChangeLogConfig): Promise<ChangeLogResult | null> {
  logger.trace('getChangeLogJSON for gitlab');
  const version = versioning.get(versionScheme);
  const { protocol, host, pathname } = URL.parse(sourceUrl);
  logger.debug({ protocol, host, pathname }, 'Protocol, host, pathname');
  const baseURL = 'https://gitlab.com/';
  const url = sourceUrl;
  // istanbul ignore if
  if (!config.token) {
    // prettier-ignore
    if (URL.parse(sourceUrl).host.search(/gitlab/) !== -1) { // lgtm [js/incomplete-url-substring-sanitization]
      logger.warn(
        {manager, depName, sourceUrl},
        'No gitlab token has been configured. Skipping release notes retrieval'
      );
      return {error: ChangeLogError.MissingGitlabToken};
    }
    // logger.warn(
    // { manager, depName, sourceUrl, config },
    // 'No gitlab.com token has been configured. Skipping release notes retrieval'
    // );
    // return { error: ChangeLogError.MissingGithubToken };
    // }
    // logger.info(
    // { manager, depName, sourceUrl },
    // 'Repository URL does not match any known gitlab hosts - skipping changelog retrieval'
    // );
    return null;
  }
  // const apiBaseURL = sourceUrl.startsWith('https://github.com/')
  // ? 'https://api.github.com/'
  // : endpoint; // TODO FIX
  // const apiBaseURL = endpoint; // TODO FIX see above
  const apiBaseURL = 'https://gitlab.com/api/v4/';
  const repository = pathname
    .slice(1)
    .replace(/\/$/, '')
    .replace(/\.git/, '');
  if (repository.split('/').length !== 2) {
    logger.info({ sourceUrl }, 'Invalid gitlab (github) URL found');
    return null;
  }
  if (!(releases && releases.length)) {
    logger.debug('No releases');
    return null;
  }
  // This extra filter/sort should not be necessary, but better safe than sorry
  const validReleases = [...releases]
    .filter(release => version.isVersion(release.version))
    .sort((a, b) => version.sortVersions(a.version, b.version));

  if (validReleases.length < 2) {
    logger.debug('Not enough valid releases');
    return null;
  }

  let tags: string[];

  async function getRef(release: Release): Promise<string | null> {
    if (!tags) {
      tags = await getTags(endpoint, versionScheme, repository);
    }
    const regex = new RegExp(`${depName}[@-]`);
    const tagName = tags
      .filter(tag => version.isVersion(tag.replace(regex, '')))
      .find(tag => version.equals(tag.replace(regex, ''), release.version));
    if (tagName) {
      return tagName;
    }
    if (release.gitRef) {
      return release.gitRef;
    }
    return null;
  }

  const cacheNamespace = 'changelog-gitlab-release';
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
      let release = await renovateCache.get(
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
          release.compare.url = `${baseURL}${repository}/compare/${prevHead}...${nextHead}`;
        }
        const cacheMinutes = 55;
        await renovateCache.set(
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
      apiBaseURL,
      baseURL,
      gitlab: repository,
      repository: sourceUrl,
      depName,
    },
    versions: changelogReleases,
  };

  res = await addReleaseNotes(res);

  return res;
}
