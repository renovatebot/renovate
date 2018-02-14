const ghGot = require('../../platform/github/gh-got-wrapper');
const semver = require('semver');

module.exports = {
  getPackageUpdates,
  getRepoTags,
  getRepoReleases,
  semverSort,
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

async function getRepoReleases(repo) {
  const url = `repos/${repo}/releases?per_page=100`;
  const res = (await ghGot(url, { paginate: true })).body;
  return res
    .map(o => o.tag_name)
    .filter(semver.valid)
    .sort(semverSort);
}

async function getPackageUpdates(config) {
  logger.debug('bazel.getPackageUpdates()');
  logger.trace({ config });
  if (config.depType === 'git_repository') {
    const { remote, currentVersion } = config;
    const githubHost = 'https://github.com/';
    if (!remote.startsWith(githubHost)) {
      logger.info({ remote }, 'Bazel warning: Unsupported remote');
      return [];
    }
    if (!semver.valid(currentVersion)) {
      logger.info({ currentVersion }, 'Bazel warning: Unsupported tag');
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
  } else if (config.depType === 'http_archive') {
    const { repo, currentVersion } = config;
    if (!semver.valid(currentVersion)) {
      logger.info({ currentVersion }, 'Bazel warning: Unsupported tag');
      return [];
    }
    const releases = await getRepoReleases(repo);
    const [latest] = releases.slice(-1);
    if (semver.gt(latest, currentVersion)) {
      const upgrade = {
        newVersion: latest,
        newVersionMajor: semver.major(latest),
        type:
          semver.major(latest) > semver.major(currentVersion)
            ? 'major'
            : 'minor',
      };
      logger.info({ upgrade });
      return [upgrade];
    }
  }
  return [];
}
