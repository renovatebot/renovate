const jwt = require('jsonwebtoken');
const logger = require('winston');
const ghApi = require('../api/github');

module.exports = {
  generateJwt,
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

async function getRepositories(config) {
  logger.debug(`githubAppHelper.getRepositories`);
  const installedRepos = [];
  try {
    const appToken = module.exports.generateJwt(config.githubAppId, config.githubAppKey);
    const installations = await ghApi.getInstallations(appToken);
    logger.verbose(`Found ${installations.length} installations`);
    for (const installation of installations) {
      logger.debug(JSON.stringify(installation));
      const installationId = installation.id;
      logger.verbose(`Checking '${installation.account.login}' (id: ${installationId})`);
      const userToken = await ghApi.getInstallationToken(appToken, installationId);
      const userRepositories = await ghApi.getInstallationRepositories(userToken);
      logger.verbose(`Found ${userRepositories.repositories.length} repositories`);
      for (repository of userRepositories.repositories) {
        installedRepos.push({
          repository: repository.full_name,
          token: userToken,
        });
      }
    }
  } catch (err) {
    logger.error(`githubAppHelper.getRepositories error: ${JSON.stringify(err)}`);
  }
  return installedRepos;
}
