import * as azure from 'azure-devops-node-api';
import * as hostRules from '../../util/host-rules';

const hostType = 'azure';
let endpoint: string;

export function azureObj() {
  const config = hostRules.find({ hostType, url: endpoint });
  if (!(config && config.token)) {
    throw new Error(`No token found for azure`);
  }
  const authHandler = azure.getPersonalAccessTokenHandler(config.token);
  return new azure.WebApi(endpoint, authHandler);
}

export function gitApi() {
  return azureObj().getGitApi();
}

export function getCoreApi() {
  return azureObj().getCoreApi();
}

export function setEndpoint(e: string) {
  endpoint = e;
}
