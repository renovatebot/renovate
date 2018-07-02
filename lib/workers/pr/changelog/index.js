const url = require('url');

const versioning = require('../../../versioning');
const { addReleaseNotes } = require('../release-notes');

const sourceCache = require('./source-cache');
const sourceGithub = require('./source-github');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(args) {
  const { repositoryUrl, versionScheme, fromVersion, toVersion } = args;
  if (!repositoryUrl) {
    return null;
  }
  // releases is too noisy in the logs
  const { releases, ...param } = args;
  logger.debug({ param }, `getChangeLogJSON(args)`);
  const { equals } = versioning(versionScheme);
  if (!fromVersion || equals(fromVersion, toVersion)) {
    return null;
  }
  const cachedResult = await sourceCache.getChangeLogJSON(args);
  if (cachedResult) {
    logger.debug('Returning cached changelog');
    return cachedResult;
  }
  let token;
  let endpoint;
  let gheBaseURL;
  let githubBaseURL = 'https://github.com/';

  if (
    process.env.GITHUB_ENDPOINT &&
    !process.env.GITHUB_ENDPOINT.startsWith('https://api.github.com')
  ) {
    const parsedEndpoint = url.parse(process.env.GITHUB_ENDPOINT);
    gheBaseURL = `${parsedEndpoint.protocol}//${parsedEndpoint.hostname}/`;
    if (repositoryUrl.startsWith(gheBaseURL)) {
      githubBaseURL = gheBaseURL;
    } else {
      // Switch tokens
      token = process.env.GITHUB_TOKEN;
      endpoint = process.env.GITHUB_ENDPOINT;
      delete process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_TOKEN = process.env.GITHUB_COM_TOKEN;
    }
  }
  try {
    const res = await sourceGithub.getChangeLogJSON({
      ...args,
      githubBaseURL,
    });
    const output = await addReleaseNotes(res);
    await sourceCache.setChangeLogJSON(args, output);
    return output;
  } catch (err) /* istanbul ignore next */ {
    logger.error(
      { err, message: err.message, stack: err.stack },
      'getChangeLogJSON error'
    );
    return null;
  } finally {
    // wrap everything in a try/finally to ensure process.env.GITHUB_TOKEN is restored no matter if
    // getChangeLogJSON and addReleaseNotes succed or fails
    if (token) {
      logger.debug('Restoring GHE token and endpoint');
      process.env.GITHUB_TOKEN = token;
      process.env.GITHUB_ENDPOINT = endpoint;
    }
  }
}
