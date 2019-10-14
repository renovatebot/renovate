import { api } from '../../../platform/gitlab/gl-got-wrapper';

const URL = require('url');
const { logger } = require('../../../logger');
const hostRules = require('../../../util/host-rules');
const versioning = require('../../../versioning');
const { addReleaseNotes } = require('./release-notes-gitlab');

const glGot = api.get;

export { getChangeLogJSON };
async function getprojectid(githubApiBaseURL, repository) {
  let url = githubApiBaseURL
    ? githubApiBaseURL.replace(/\/?$/, '/')
    : 'https://gitlab.com/api/v4/';
  let project = repository.split('/').pop();
  let repopath = repository.replace(RegExp('^/'), '');
  let search_string = `${url}search?scope=projects&search=${project}&per_page=100`;
  let repoid = null;
  try {
    const res = await glGot(search_string, {
      paginate: true,
    });
    logger.debug(
      `Response for query ${search_string}:\n ${JSON.stringify(
        res.body
      )}\n status code:\n ${res.statusCode}`
    );
    for (let i of res.body) {
      if (i.path_with_namespace.includes(repopath)) {
        repoid = i.id;
      }
    }
  } catch (err) {
    logger.info(`Can't get project for ${repository}`);
    logger.debug({ err });
  }
  if (repoid == null) {
    logger.debug(
      `can't get repoid for ${repository} with ${repopath} search string is ${search_string}`
    );
  }
  return repoid;
}
async function getTags(endpoint, versionScheme, repository, repoid) {
  let url = endpoint
    ? endpoint.replace(/\/?$/, '/')
    : 'https://gitlab.com/api/v4/';
  let tagsearch = `${endpoint}projects/${repoid}/repository/tags?per_page=100`;
  try {
    const res = await glGot(tagsearch, {
      paginate: true,
    });

    const tags = (res && res.body) || [];

    if (!tags.length) {
      logger.debug({ repository }, 'repository has no gitlab tags');
    }

    return tags.map(tag => tag.name);
  } catch (err) {
    logger.info({ sourceRepo: repository }, 'Failed to fetch gitlab tags');
    logger.debug({ err });
    return [];
  }
}

async function getChangeLogJSON({
  endpoint,
  versionScheme,
  fromVersion,
  toVersion,
  sourceUrl,
  releases,
  depName,
  manager,
}) {
  const version = versioning.get(versionScheme);
  logger.debug(`source url is: ${sourceUrl}`);
  logger.debug(`endpoint url is: ${endpoint}`);
  const { protocol, host, pathname } = URL.parse(sourceUrl);
  const githubBaseURL = `${protocol}//${host}/`;
  logger.debug(`Gitlab base url: ${githubBaseURL}`);
  const url = `${protocol}//${host}/`;
  const config = hostRules.find({
    hostType: 'gitlab',
    url,
  });
  logger.debug(`Host rules for ${url} : ${config}`);
  logger.debug(`GItlab  url: ${url}`);
  if (!config.token) {
    logger.debug('Repository URL does not match any known hosts');
    return null;
  }
  const githubApiBaseURL = sourceUrl.startsWith('https://gitlab.com/')
    ? 'https://gitlab.com/api/v4/'
    : `${protocol}//${host}/api/v4/`;
  logger.debug(`Gitlab githubApiBaseURL url: ${githubApiBaseURL}`);
  const repository = pathname.slice(1).replace(/\/$/, '');
  if (repository.split('/').length < 2 && repository.split('/').length > 3) {
    logger.info({ sourceUrl }, 'Invalid gitlab URL found');
    return null;
  }
  if (!(releases && releases.length)) {
    logger.debug('No releases');
    return null;
  }
  let repoid = await getprojectid(githubApiBaseURL, repository);
  // Probably unnecessary checks from source-gitlab.js,here for the sake of keeping things consistent.
  const validReleases = [...releases]
    .filter(release => version.isVersion(release.version))
    .sort((a, b) => version.sortVersions(a.version, b.version));

  if (validReleases.length < 2) {
    logger.debug('Not enough valid releases');
    return null;
  }

  let tags;

  async function getRef(release) {
    if (!tags) {
      tags = await getTags(githubApiBaseURL, versionScheme, repository, repoid);
    }
    const regex = new RegExp(`${depName}[@-]`);
    const tagName = tags
      .filter(tag => version.isVersion(tag.replace(regex, '')))
      .find(tag => version.equals(tag.replace(regex, ''), release.version));
    if (tagName) {
      return tagName;
    }
    return null;
  }

  const cacheNamespace = 'changelog-gitlab-release';
  function getCacheKey(prev, next) {
    return `${manager}:${depName}:${prev}:${next}`;
  }

  const changelogReleases = [];
  // compare versions
  const include = v =>
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
          release.compare.url = `${githubBaseURL}${repository}/compare/${prevHead}...${nextHead}`;
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

  let res = {
    project: {
      githubApiBaseURL,
      githubBaseURL,
      github: repository,
      repoid: repoid,
      repository: sourceUrl,
      depName,
    },
    versions: changelogReleases,
  };

  res = await addReleaseNotes(res);

  return res;
}
