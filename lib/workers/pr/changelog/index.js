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
  const { manager, fromVersion, newValue } = args;
  logger.debug({ args }, `getChangeLogJSON(args)`);
  if (!fromVersion || fromVersion === newValue) {
    return null;
  }

  let isGHE = false;
  let token;
  let endpoint;
  let gheBaseURL;
  const opts = {
    githubBaseURL: 'https://github.com/',
  };

  if (process.env.GITHUB_ENDPOINT) {
    // By default we consider the dependency we are retrieving the changelog for, hosted on github.com
    // Because of this we unset GHE GITHUB_ENPOINT and we use GITHUB_COM_TOKEN as the token used to authenticate with github.com
    isGHE = true;
    token = process.env.GITHUB_TOKEN;
    endpoint = process.env.GITHUB_ENDPOINT;
    const parsedEndpoint = url.parse(endpoint);
    gheBaseURL = `${parsedEndpoint.protocol}//${parsedEndpoint.hostname}/`;
    delete process.env.GITHUB_ENDPOINT;
    process.env.GITHUB_TOKEN = process.env.GITHUB_COM_TOKEN;
  }

  try {
    // Return from cache if present
    let res = await sourceCache.getChangeLogJSON(args);
    if (!res) {
      let pkg = null;
      if (['npm', 'meteor'].includes(manager)) {
        pkg = await managerNpm.getPackage(args);
      }

      if (manager === 'pip_requirements') {
        pkg = await managerPip.getPackage(args);
      }

      if (
        isGHE &&
        pkg &&
        pkg.repositoryUrl &&
        pkg.repositoryUrl.startsWith(gheBaseURL)
      ) {
        // IF we are using GithubEnterprise and the dependency is hosted on it (instead of github.com) then we use
        // the GHE token and endpoint. The hosting condition if verified by comparin github enterprise and dependency hostnames
        logger.debug(
          'Found package hosted on internal GHE. Restoring GHE token'
        );
        opts.githubBaseURL = gheBaseURL;
        process.env.GITHUB_TOKEN = token;
        process.env.GITHUB_ENDPOINT = endpoint;
      }

      res = await sourceGithub.getChangeLogJSON({
        ...args,
        ...pkg,
        ...opts,
      });

      await sourceCache.setChangeLogJSON(args, res);
    }

    if (
      isGHE &&
      res &&
      res.project &&
      res.project.githubBaseURL === gheBaseURL &&
      process.env.GITHUB_ENDPOINT !== endpoint
    ) {
      // If we are using GithubEnterprise and the dependency is hosted on it (instead of github.com) then we use
      // the GHE token and endpoint, if we hadn't done it already (when res is coming from cache)
      logger.debug('Found package hosted on internal GHE. Restoring GHE token');
      process.env.GITHUB_TOKEN = token;
      process.env.GITHUB_ENDPOINT = endpoint;
    }

    const output = await addReleaseNotes(res);

    return output;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err, message: err.message }, 'getChangeLogJSON error');
    return null;
  } finally {
    // wrap everything in a try/finally to ensure process.env.GITHUB_TOKEN is restored no matter if
    // getChangeLogJSON and addReleaseNotes succed or fails
    if (isGHE) {
      logger.debug('Restoring GHE token and endpoint');
      process.env.GITHUB_TOKEN = token;
      process.env.GITHUB_ENDPOINT = endpoint;
    }
  }
}
