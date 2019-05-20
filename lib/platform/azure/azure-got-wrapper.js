const azure = require('azure-devops-node-api');
const hostRules = require('../../util/host-rules');

const platform = 'azure';
let endpoint;

module.exports = {
  azureObj,
  gitApi,
  getCoreApi,
  setEndpoint,
};

function azureObj() {
  const config = hostRules.find({ platform, endpoint });
  if (!(config && config.token)) {
    throw new Error(`No token found for azure`);
  }
  const authHandler = azure.getPersonalAccessTokenHandler(config.token);
  return new azure.WebApi(endpoint, authHandler);
}

function gitApi() {
  return azureObj().getGitApi();
}

function getCoreApi() {
  return azureObj().getCoreApi();
}

function setEndpoint(e) {
  endpoint = e;
}
