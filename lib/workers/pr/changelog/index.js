const url = require('url');

const { addReleaseNotes } = require('../release-notes');

const sourceCache = require('./source-cache');
const sourceGithub = require('./source-github');

const managerNpm = require('./manager-npm');
const managerPip = require('./manager-pip');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(args) {
  const { manager, fromVersion, newVersion } = args;
  logger.debug({ args }, `getChangeLogJSON(args)`);
  if (!fromVersion || fromVersion === newVersion) {
    return null;
  }

  let token;
  let endpoint;
  let gheBaseURL;
  const opts = {
    githubBaseURL: 'https://github.com/',
  };

  // istanbul ignore if
  if (process.env.GITHUB_ENDPOINT) {
    token = process.env.GITHUB_TOKEN;
    endpoint = process.env.GITHUB_ENDPOINT;
    const parsedEndpoint = url.parse(endpoint);
    gheBaseURL = `${parsedEndpoint.protocol}//${parsedEndpoint.hostname}/`;
  }

  // Return from cache if present
  let res = await sourceCache.getChangeLogJSON(args);
  if (res) {
    if (res.project && res.project.githubBaseURL !== gheBaseURL) {
      logger.debug('Removing GHE token before calling addReleaseNotes');
      delete process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_TOKEN = process.env.GITHUB_COM_TOKEN;
    }
  } else {
    let pkg = null;
    if (['npm', 'meteor'].includes(manager)) {
      pkg = await managerNpm.getPackage(args);
    }

    if (manager === 'pip_requirements') {
      pkg = await managerPip.getPackage(args);
    }

    if (
      pkg &&
      pkg.repositoryUrl &&
      gheBaseURL &&
      pkg.repositoryUrl.startsWith(gheBaseURL)
    ) {
      logger.debug(
        'Found package hosted on internal GHE. Preserving GHE token'
      );
      opts.githubBaseURL = gheBaseURL;
    } else {
      logger.debug('Removing GHE token before calling getChangeLogJSON');
      delete process.env.GITHUB_ENDPOINT;
      process.env.GITHUB_TOKEN = process.env.GITHUB_COM_TOKEN;
    }

    res = await sourceGithub.getChangeLogJSON({ ...args, ...pkg, ...opts });

    await sourceCache.setChangeLogJSON(args, res);
  }

  const outuput = await addReleaseNotes(res);

  // istanbul ignore if
  if (endpoint !== process.env.GITHUB_ENDPOINT) {
    logger.debug('Restoring GHE token and endpoint');
    process.env.GITHUB_TOKEN = token;
    process.env.GITHUB_ENDPOINT = endpoint;
  }

  return outuput;
}
