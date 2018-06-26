const ghGot = require('../platform/github/gh-got-wrapper');
const versioning = require('../versioning');

module.exports = {
  getDependency,
};

async function getDependency(purl, config) {
  const { versionScheme } = config || {};
  const { fullname: repo, qualifiers: options } = purl;
  let versions;
  let endpoint;
  let token;
  // istanbul ignore if
  if (
    process.env.GITHUB_ENDPOINT &&
    !process.env.GITHUB_ENDPOINT.startsWith('https://api.github.com')
  ) {
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
      const url = `repos/${repo}/tags?per_page=100`;
      versions = (await ghGot(url, { paginate: true })).body.map(o => o.name);
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
  const { isVersion, sortVersions } = versioning(versionScheme);
  // Return a sorted list of valid Versions
  versions = versions.filter(isVersion).sort(sortVersions);
  const dependency = {
    repositoryUrl: 'https://github.com/' + repo,
  };
  dependency.releases = versions.map(version => ({
    version: options.sanitize === 'true' ? isVersion(version) : version,
    gitRef: version,
  }));
  return dependency;
}
