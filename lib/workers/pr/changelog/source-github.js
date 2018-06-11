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
  const date = version.date || version.time;
  if (!date) {
    return null;
  }
  logger.trace({ repository, version }, 'Looking for commit SHA by date');
  try {
    const res = await ghGot(`repos/${repository}/commits/@{${date}}`);
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
  logger.debug('Checking for github source URL manually');
  const include = version =>
    isGreaterThan(version, fromVersion) && !isGreaterThan(version, toVersion);

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

  function getHead(release) {
    const tagName = Object.keys(tags).find(key => equals(key, release.version));
    return getRepositoryHead(repository, {
      ...release,
      ...tags[tagName],
    });
  }

  const changelogReleases = [];
  // compare versions
  for (let i = 1; i < validReleases.length; i += 1) {
    const prev = validReleases[i - 1];
    const next = validReleases[i];
    if (include(next.version)) {
      const release = {
        version: next.version,
        date: next.date || next.time,
        // put empty changes so that existing templates won't break
        changes: [],
        compare: {},
      };
      const prevHead = await getHead(prev);
      const nextHead = await getHead(next);
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
