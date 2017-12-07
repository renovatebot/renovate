const ghGot = require('../../platform/github/gh-got-wrapper');
const semver = require('semver');

module.exports = {
  getPackageUpdates,
};

function semverSort(a, b) {
  return semver.compare(a, b);
}

async function getRepoTags(repo) {
  const url = `repos/${repo}/git/refs?per_page=100`;
  const res = (await ghGot(url, { paginate: true })).body;
  const tagPrefix = 'refs/tags/';
  return res
    .filter(o => o.ref.startsWith(tagPrefix))
    .map(o => o.ref.replace(tagPrefix, ''))
    .filter(o => semver.valid(o))
    .sort(semverSort);
}

async function getPackageUpdates(config) {
  logger.debug('bazel.getPackageUpdates()');
  logger.trace({ config });
  const { remote, currentVersion } = config;
  const githubHost = 'https://github.com/';
  if (!remote.startsWith(githubHost)) {
    logger.warn({ remote }, 'Unsupported bazel remote');
    return [];
  }
  if (!semver.valid(currentVersion)) {
    logger.warn({ currentVersion }, 'Unsupported bazel tag');
    return [];
  }
  const repo = remote.substring(githubHost.length).replace(/.git$/, '');
  const tags = await getRepoTags(repo);
  const [newestTag] = tags.slice(-1);
  if (semver.gt(newestTag, currentVersion)) {
    return [
      {
        newVersion: newestTag,
        newVersionMajor: semver.major(newestTag),
        type:
          semver.major(newestTag) > semver.major(currentVersion)
            ? 'major'
            : 'minor',
      },
    ];
  }
  return [];
}
