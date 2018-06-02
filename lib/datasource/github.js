const ghGot = require('../platform/github/gh-got-wrapper');
const { isPinnedVersion } = require('../versioning/semver');

module.exports = {
  getDependency,
};

async function getDependency(repo, options = {}) {
  const ref = options.ref || 'tag';
  const clean = options.clean === 'true';
  let versions;
  let endpoint;
  let token;
  // istanbul ignore if
  if (process.env.GITHUB_ENDPOINT) {
    logger.debug('Removing GHE token before retrieving node releases');
    endpoint = process.env.GITHUB_ENDPOINT;
    delete process.env.GITHUB_ENDPOINT;
    token = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = process.env.GITHUB_COM_TOKEN;
  }
  try {
    if (ref === 'tag') {
      const url = `repos/${repo}/git/refs/tags?per_page=100`;
      const tagPrefix = 'refs/tags/';
      versions = (await ghGot(url, { paginate: true })).body
        .filter(o => o.ref && o.ref.startsWith(tagPrefix))
        .map(o => o.ref.replace(tagPrefix, ''));
    } else if (ref === 'release') {
      const url = `repos/${repo}/releases?per_page=100`;
      versions = (await ghGot(url, { paginate: true })).body.map(
        o => o.tag_name
      );
    }
  } catch (err) {
    logger.info(
      { repo, err, message: err.message },
      'Error retrieving from github'
    );
  } finally {
    // istanbul ignore if
    if (endpoint) {
      logger.debug('Restoring GHE token and endpoint');
      process.env.GITHUB_TOKEN = token;
      process.env.GITHUB_ENDPOINT = endpoint;
    }
  }
  if (!versions) {
    return null;
  }
  versions = versions.filter(version => isPinnedVersion(version));
  if (clean) {
    versions = versions.map(version => version.replace(/^v/, ''));
  }
  const dependency = {
    repositoryUrl: 'https://github.com/' + repo,
    versions: {},
  };
  versions.forEach(version => {
    dependency.versions[version] = {};
  });
  return dependency;
}
