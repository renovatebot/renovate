const npmRegistry = require('../../../datasource/npm');
const { matchesSemver, isPinnedVersion } = require('../../../util/semver');
const ghGot = require('../../../platform/github/gh-got-wrapper');

module.exports = {
  getChangeLogJSON,
};

async function getTags(repository) {
  const tags = await ghGot(
    `https://api.github.com/repos/${repository}/tags?per_page=100`
  );
  const versions = {};
  tags.forEach(tag => {
    const version = isPinnedVersion(tag.name);
    if (version) {
      versions[version] = { gitHead: tag.commit.sha };
    }
  });
  return versions;
}

async function getChanges(repository, from, to) {
  const diff = await ghGot(
    `https://api.github.com/repos/${repository}/compare/${from}...${to}`
  );
  if (!(diff && diff.commits)) {
    return [];
  }
  return diff.commits.map(commit => ({
    sha: commit.sha,
    message: commit.commit.message,
    date: commit.commit.committer.date,
  }));
}

async function getTimeHead(repository, time) {
  logger.info({repository, time}, 'Looking for commit SHA');
  if (!time) {
    return null;
  }
  const commit = await ghGot(
    `https://api.github.com/repos/${repository}/commits/@{${time}}`
  );
  return commit && commit.sha;
}

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  logger.debug('Checking for github source URL manually');
  const semverString = `>${fromVersion} <=${newVersion}`;
  logger.trace(`semverString: ${semverString}`);
  const dep = await npmRegistry.getDependency(depName);
  // istanbul ignore if
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

  const tags = getTags(repository);
  const versions = Object.keys(dep.versions).map(version => ({
    version,
    changes: [],
    gitHead: Object.assign({}, dep.versions[version], tags[version]).gitHead,
  }));

  // Add changes
  for (let i = 1; i < versions.length; i += 1) {
    const prev = versions[i - 1];
    const next = versions[i];
    if (matchesSemver(next.version, semverString)) {
      prev.gitHead = prev.gitHead || await getTimeHead(repository, prev.time);
      next.gitHead = next.gitHead || await getTimeHead(repository, next.time);
      if (prev.gitHead && next.gitHead) {
        next.changes = getChanges(repository, prev.gitHead, next.gitHead);
      }
    }
  }

  const res = {
    project: {
      github: repository,
    },
    versions: versions.filter(v => matchesSemver(v.version, semverString)),
  };

  logger.debug({ res }, 'Manual res');
  return res;
}
