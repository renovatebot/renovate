const versioning = require('../../../versioning');
const ghGot = require('../../../platform/github/gh-got-wrapper');

module.exports = {
  getChangeLogJSON,
};

async function getTags(versionScheme, repository) {
  const { isVersion } = versioning(versionScheme);
  try {
    const versions = {};

    const res = await ghGot(`repos/${repository}/tags?per_page=100`, {
      paginate: true,
    });

    const tags = (res && res.body) || [];

    if (!tags.length) {
      logger.debug({ repository }, 'repository has no Github tags');
    }

    tags.forEach(tag => {
      const version = isVersion(tag.name);
      if (version) {
        versions[version] = { gitRef: tag.name };
      }
    });
    return versions;
  } catch (err) {
    logger.info({ sourceRepo: repository }, 'Failed to fetch Github tags');
    logger.debug({
      err,
      message: err.message,
      body: err.response ? err.response.body : undefined,
    });
    return {};
  }
}

async function getRepositoryHead(repository, version) {
  if (version.gitRef) {
    return version.gitRef;
  }
  if (!version.date) {
    return null;
  }
  logger.trace({ repository, version }, 'Looking for commit SHA by date');
  try {
    const res = await ghGot(`repos/${repository}/commits/@{${version.date}}`);
    const commit = res && res.body;
    return commit && commit.sha;
  } catch (err) {
    logger.debug({ err, repository }, 'Failed to fetch Github commit by date');
    return null;
  }
}

async function getChangeLogJSON({
  versionScheme,
  githubBaseURL,
  repositoryUrl,
  fromVersion,
  newValue,
  versions,
}) {
  const { equals, isGreaterThan } = versioning(versionScheme);
  logger.debug('Checking for github source URL manually');
  const include = version =>
    isGreaterThan(version, fromVersion) && !isGreaterThan(version, newValue);

  if (!(repositoryUrl && repositoryUrl.startsWith(githubBaseURL))) {
    logger.debug('No repo found manually');
    return null;
  }
  logger.debug({ url: repositoryUrl }, 'Found github URL manually');
  const repository = repositoryUrl
    .replace(githubBaseURL, '')
    .replace(/#.*/, '');
  if (repository.split('/').length !== 2) {
    logger.debug('Invalid github URL found');
    return null;
  }

  const tags = await getTags(versionScheme, repository);

  function getHead(version) {
    const tagName = Object.keys(tags).find(key => equals(key, version.version));
    return getRepositoryHead(repository, {
      ...version,
      ...tags[tagName],
    });
  }

  const releases = [];

  // compare versions
  for (let i = 1; i < versions.length; i += 1) {
    const prev = versions[i - 1];
    const next = versions[i];
    if (include(next.version)) {
      const release = {
        version: next.version,
        date: next.date,
        // put empty changes so that existing templates won't break
        changes: [],
        compare: {},
      };
      const prevHead = await getHead(prev);
      const nextHead = await getHead(next);
      if (prevHead && nextHead) {
        release.compare.url = `${githubBaseURL}${repository}/compare/${prevHead}...${nextHead}`;
      }
      releases.unshift(release);
    }
  }

  const res = {
    project: {
      githubBaseURL,
      github: repository,
      repository: repositoryUrl,
    },
    versions: releases,
  };

  logger.debug({ res }, 'Manual res');
  return res;
}
