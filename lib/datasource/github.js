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
