const ghGot = require('../platform/github/gh-got-wrapper');
const versioning = require('../versioning');

module.exports = {
  getDependency,
};

async function getDependency(repo, options = {}) {
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
    if (options.ref === 'release') {
      const url = `repos/${repo}/releases?per_page=100`;
      versions = (await ghGot(url, { paginate: true })).body.map(
        o => o.tag_name
      );
    } else {
      // tag
      const url = `repos/${repo}/git/refs/tags?per_page=100`;
      const tagPrefix = 'refs/tags/';
      versions = (await ghGot(url, { paginate: true })).body
        .filter(o => o.ref && o.ref.startsWith(tagPrefix))
        .map(o => o.ref.replace(tagPrefix, ''));
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
  // Filter by semver if no versionScheme provided
  const { isVersion } = versioning(options.versionScheme || 'semver');
  versions = versions.filter(version => isVersion(version));
  if (options.clean === 'true') {
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
