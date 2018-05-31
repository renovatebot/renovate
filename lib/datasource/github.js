const ghGot = require('../platform/github/gh-got-wrapper');
const { isPinnedVersion, sortVersions } = require('../versioning/semver');

module.exports = {
  getDependency,
  getRepoTags,
  getRepoReleases,
};

async function getDependency(repo) {
  try {
    const url = `repos/${repo}/git/refs/tags?per_page=100`;
    const res = (await ghGot(url, { paginate: true })).body;
    logger.trace({ res });
    const tagPrefix = 'refs/tags/';
    const versions = res
      .filter(o => o.ref.startsWith(tagPrefix))
      .map(o => o.ref.replace(tagPrefix, ''))
      .filter(isPinnedVersion)
      .map(tag => tag.replace(/^v/, ''))
      .sort(sortVersions);
    const dependency = {
      repositoryUrl: 'https://github.com/' + repo,
      versions: {},
    };
    versions.forEach(version => {
      dependency.versions[version] = {};
    });
    return dependency;
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ repo }, 'Could not fetch github dependency');
    return null;
  }
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
      .filter(isPinnedVersion)
      .sort(sortVersions);
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
      .filter(isPinnedVersion)
      .sort(sortVersions);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ repo }, 'Could not fetch repo releases');
    return [];
  }
}
