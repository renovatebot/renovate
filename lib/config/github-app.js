const jwt = require('jsonwebtoken');
const logger = require('../logger');
const ghApi = require('../api/github');

module.exports = {
  generateJwt,
  getUserRepositories,
  getRepositories,
};

function generateJwt(appId, pemFileContent) {
  logger.debug(`githubApp.generateJwt(${appId})`);
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
  logger.debug(`githubApp.getUserRepositories(appToken, ${installationId})`);
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
  logger.debug(`githubApp.getRepositories`);
  const configuredRepositories = config.repositories.map(
    repository =>
      typeof repository === 'string' ? repository : repository.repository
  );
  let installedRepos = [];
  try {
    const appToken = module.exports.generateJwt(
      config.githubAppId,
      config.githubAppKey
    );
    const installations = await ghApi.getInstallations(appToken);
    logger.info(`Found installations for ${installations.length} users`);
    for (const installation of installations) {
      logger.debug(`installation=${JSON.stringify(installation)}`);
      let installationRepos = await module.exports.getUserRepositories(
        appToken,
        installation.id
      );
      logger.debug(`installationRepos=${JSON.stringify(installationRepos)}`);
      if (configuredRepositories.length) {
        installationRepos = installationRepos.filter(
          repository =>
            configuredRepositories.indexOf(repository.repository) !== -1
        );
      }
      installedRepos = installedRepos.concat(installationRepos);
    }
  } catch (err) {
    logger.error(`githubApp.getRepositories error: ${JSON.stringify(err)}`);
  }
  logger.debug(`installedRepos=${JSON.stringify(installedRepos)}`);
  return installedRepos;
}
