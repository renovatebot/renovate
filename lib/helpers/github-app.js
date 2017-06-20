const jwt = require('jsonwebtoken');
const logger = require('winston');
const ghApi = require('../api/github');

module.exports = {
  generateJwt,
  getUserRepositories,
  getRepositories,
};

function generateJwt(appId, pemFileContent) {
  logger.debug(`githubAppHelper.generateJwt(${appId})`);
  const payload = {
    // GitHub app identifier
    iss: appId,
  };
  const options = {
    // 5 minutes
    expiresIn: 300,
    // RS256 required by GitHub
    algorithm: 'RS256',
  };
  return jwt.sign(payload, pemFileContent, options);
}

async function getUserRepositories(appToken, installationId) {
  logger.debug(
    `githubAppHelper.getUserRepositories(appToken, ${installationId})`
  );
  const userToken = await ghApi.getInstallationToken(appToken, installationId);
  logger.debug(`userToken=${userToken}`);
  const userRepositories = await ghApi.getInstallationRepositories(userToken);
  logger.debug(`Found ${userRepositories.repositories.length} repositories`);
  return userRepositories.repositories.map(repository => ({
    repository: repository.full_name,
    token: userToken,
  }));
}

async function getRepositories(config) {
  logger.debug(`githubAppHelper.getRepositories`);
  let installedRepos = [];
  try {
    const appToken = module.exports.generateJwt(
      config.githubAppId,
      config.githubAppKey
    );
    const installations = await ghApi.getInstallations(appToken);
    logger.info(`Found installations for ${installations.length} users`);
    for (const installation of installations) {
      logger.debug(JSON.stringify(installation));
      const installationRepos = await module.exports.getUserRepositories(
        appToken,
        installation.id
      );
      logger.debug(`installationRepos=${JSON.stringify(installationRepos)}`);
      installedRepos = installedRepos.concat(installationRepos);
    }
  } catch (err) {
    logger.error(
      `githubAppHelper.getRepositories error: ${JSON.stringify(err)}`
    );
  }
  logger.debug(`installedRepos=${JSON.stringify(installedRepos)}`);
  return installedRepos;
}
