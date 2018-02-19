const vsts = require('vso-node-api');

module.exports = {
  vstsObj,
  gitApi,
  getCoreApi,
};

function vstsObj() {
  if (!process.env.VSTS_TOKEN) {
    throw new Error(`No token found for vsts`);
  }
  if (!process.env.VSTS_ENDPOINT) {
    throw new Error(
      `You need an endpoint with vsts. Something like this: https://{instance}.VisualStudio.com/{collection} (https://fabrikam.visualstudio.com/DefaultCollection)`
    );
  }
  const authHandler = vsts.getPersonalAccessTokenHandler(
    process.env.VSTS_TOKEN
  );
  return new vsts.WebApi(process.env.VSTS_ENDPOINT, authHandler);
}

function gitApi() {
  return vstsObj().getGitApi();
}

function getCoreApi() {
  return vstsObj().getCoreApi();
}
