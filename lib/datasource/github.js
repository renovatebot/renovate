const ghGot = require('../platform/github/gh-got-wrapper');

module.exports = {
  getDependency,
};

async function getDependency(purl) {
  const { fullname: repo, qualifiers: options } = purl;
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
  const dependency = {
    repositoryUrl: 'https://github.com/' + repo,
  };
  // TODO: should Github receive the versionScheme as input?
  // versions should be already sorted by GIT
  dependency.releases = versions.map(version => ({
    version: version.replace(/^v(\d)/, '$1'),
    gitHead: version,
  }));
  return dependency;
}
