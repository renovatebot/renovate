const npmRegistry = require('../../../datasource/npm');
const {
  matchesSemver,
  isPinnedVersion,
  semverSort,
} = require('../../../util/semver');
const ghGot = require('../../../platform/github/gh-got-wrapper');

module.exports = {
  getChangeLogJSON,
};

async function getTags(repository) {
  try {
    const versions = {};

    const res = await ghGot(
      `https://api.github.com/repos/${repository}/tags?per_page=100`,
      { paginate: true }
    );

    const tags = (res && res.body) || [];

    if (!tags.length) {
      logger.debug({ repository }, 'repository has no Github tags');
    }

    tags.forEach(tag => {
      const version = isPinnedVersion(tag.name);
      if (version) {
        versions[version] = { gitHead: tag.name };
      }
    });
    return versions;
  } catch (err) {
    logger.debug({ err, repository }, 'Failed to fetch Github tags');
    return {};
  }
}

async function getRepositoryHead(repository, version) {
  if (version.gitHead) {
    return version.gitHead;
  }
  if (!version.time) {
    return null;
  }
  logger.info({ repository, version }, 'Looking for commit SHA by time');
  try {
    const res = await ghGot(
      `https://api.github.com/repos/${repository}/commits/@{${version.time}}`
    );
    const commit = res && res.body;
    return commit && commit.sha;
  } catch (err) {
    logger.debug({ err, repository }, 'Failed to fetch Github commit by time');
    return null;
  }
}

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  logger.debug('Checking for github source URL manually');
  const semverString = `>${fromVersion} <=${newVersion}`;
  logger.trace(`semverString: ${semverString}`);
  const dep = await npmRegistry.getDependency(depName);
  if (
    !(
      dep &&
      dep.repositoryUrl &&
      dep.repositoryUrl.startsWith('https://github.com/')
    )
  ) {
    logger.debug('No repo found manually');
    return null;
  }
  logger.info({ url: dep.repositoryUrl }, 'Found github URL manually');
  const repository = dep.repositoryUrl
    .replace('https://github.com/', '')
    .replace(/#.*/, '');
  if (repository.split('/').length !== 2) {
    logger.debug('Invalid github URL found');
    return null;
  }

  const tags = await getTags(repository);
  const releases = Object.keys(dep.versions);
  releases.sort(semverSort);

  function getHead(name) {
    return getRepositoryHead(repository, {
      ...dep.versions[name],
      ...tags[name],
    });
  }

  const versions = [];
  // compare versions
  for (let i = 1; i < releases.length; i += 1) {
    const prev = releases[i - 1];
    const next = releases[i];
    if (matchesSemver(next, semverString)) {
      const version = {
        version: next,
        date: dep.versions[next].time,
        // put empty changes so that existing templates won't break
        changes: [],
        compare: {},
      };
      const prevHead = await getHead(prev);
      const nextHead = await getHead(next);
      if (prevHead && nextHead) {
        version.compare.url = `https://github.com/${repository}/compare/${prevHead}...${nextHead}`;
      }
      versions.unshift(version);
    }
  }

  const res = {
    project: {
      github: repository,
      repository: dep.repositoryUrl,
    },
    versions,
  };

  logger.debug({ res }, 'Manual res');
  return res;
}
