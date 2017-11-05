const vsts = require('vso-node-api');

function gitApi() {
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
  const connect = new vsts.WebApi(process.env.VSTS_ENDPOINT, authHandler);
  return connect.getGitApi();
}

module.exports = gitApi;
