const versioning = require('../../../versioning');
const ghGot = require('../../../platform/github/gh-got-wrapper');

module.exports = {
  getChangeLogJSON,
};

async function getTags(versionScheme, repository) {
  const { isVersion } = versioning(versionScheme);
  try {
    const res = await ghGot(`repos/${repository}/tags?per_page=100`, {
      paginate: true,
    });

    const tags = (res && res.body) || [];

    if (!tags.length) {
      logger.debug({ repository }, 'repository has no Github tags');
    }

    return tags.filter(tag => isVersion(tag.name)).map(tag => tag.name);
  } catch (err) {
    logger.info({ sourceRepo: repository }, 'Failed to fetch Github tags');
    logger.debug({
      err,
      message: err.message,
      body: err.response ? err.response.body : undefined,
    });
    // istanbul ignore if
    if (err.message && err.message.includes('Bad credentials')) {
      logger.warn('Bad credentials triggering tag fail lookup in changelog');
      throw err;
    }
    return [];
  }
}

async function getDateRef(repository, timestamp) {
  if (!timestamp) {
    return null;
  }
  logger.trace({ repository, timestamp }, 'Looking for commit SHA by date');
  try {
    const res = await ghGot(`repos/${repository}/commits/@{${timestamp}}`);
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
  fromVersion,
  toVersion,
  repositoryUrl,
  releases,
}) {
  const { isVersion, equals, isGreaterThan, sortVersions } = versioning(
    versionScheme
  );
  if (!(repositoryUrl && repositoryUrl.startsWith(githubBaseURL))) {
    logger.debug('Repository URL does not match base URL');
    return null;
  }
  const repository = repositoryUrl
    .replace(githubBaseURL, '')
    .replace(/#.*/, '');
  if (repository.split('/').length !== 2) {
    logger.info('Invalid github URL found');
    return null;
  }
  if (!(releases && releases.length)) {
    logger.debug('No releases');
    return null;
  }
  // This extra filter/sort should not be necessary, but better safe than sorry
  const validReleases = [...releases]
    .filter(release => isVersion(release.version))
    .sort((a, b) => sortVersions(a.version, b.version));

  if (validReleases.length < 2) {
    logger.debug('Not enough valid releases');
    return null;
  }

  const tags = await getTags(versionScheme, repository);

  function getRef(release) {
    const tagName = tags.find(tag => equals(tag, release.version));
    if (tagName) {
      return tagName;
    }
    if (release.gitRef) {
      return release.gitRef;
    }
    return getDateRef(repository, release.releaseTimestamp);
  }

  const changelogReleases = [];
  // compare versions
  const include = version =>
    isGreaterThan(version, fromVersion) && !isGreaterThan(version, toVersion);
  for (let i = 1; i < validReleases.length; i += 1) {
    const prev = validReleases[i - 1];
    const next = validReleases[i];
    if (include(next.version)) {
      const release = {
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
      changelogReleases.unshift(release);
    }
  }

  const res = {
    project: {
      githubBaseURL,
      github: repository,
      repository: repositoryUrl,
    },
    versions: changelogReleases,
  };

  logger.debug({ res }, 'Manual res');
  return res;
}
