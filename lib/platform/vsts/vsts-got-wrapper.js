const vsts = require('vso-node-api');
const endpoints = require('../../util/endpoints');

module.exports = {
  vstsObj,
  gitApi,
  getCoreApi,
};

function vstsObj() {
  const config = endpoints.find({ platform: 'vsts' }, {});
  if (!config.token) {
    throw new Error(`No token found for vsts`);
  }
  const authHandler = vsts.getPersonalAccessTokenHandler(config.token);
  return new vsts.WebApi(config.endpoint, authHandler);
}

function gitApi() {
  return vstsObj().getGitApi();
}

function getCoreApi() {
  return vstsObj().getCoreApi();
}
