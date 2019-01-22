const azure = require('azure-devops-node-api');
const hostRules = require('../../util/host-rules');

module.exports = {
  azureObj,
  gitApi,
  getCoreApi,
};

function azureObj() {
  const config = hostRules.find({ platform: 'azure' }, {});
  if (!config.token) {
    throw new Error(`No token found for azure`);
  }
  const authHandler = azure.getPersonalAccessTokenHandler(config.token);
  return new azure.WebApi(config.endpoint, authHandler);
}

function gitApi() {
  return azureObj().getGitApi();
}

function getCoreApi() {
  return azureObj().getCoreApi();
}
