const ghGot = require('../platform/github/gh-got-wrapper');
const semver = require('semver');

module.exports = {
  getRepoTags,
  getRepoReleases,
};

function semverSort(a, b) {
  return semver.compare(a, b);
}

async function getRepoTags(repo) {
  try {
    const url = `repos/${repo}/git/refs/tags?per_page=100`;
    const res = (await ghGot(url, { paginate: true })).body;
    logger.trace({ res });
    const tagPrefix = 'refs/tags/';
    return res
      .filter(o => o.ref.startsWith(tagPrefix))
      .map(o => o.ref.replace(tagPrefix, ''))
      .filter(o => semver.valid(o))
      .sort(semverSort);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ repo }, 'Could not fetch repo tags');
    return [];
  }
}

async function getRepoReleases(repo) {
  try {
    const url = `repos/${repo}/releases?per_page=100`;
    const res = (await ghGot(url, { paginate: true })).body;
    return res
      .map(o => o.tag_name)
      .filter(semver.valid)
      .sort(semverSort);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ repo }, 'Could not fetch repo releases');
    return [];
  }
}
