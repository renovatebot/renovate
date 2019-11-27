import * as azure from 'azure-devops-node-api';
import { IGitApi } from 'azure-devops-node-api/GitApi';
import { ICoreApi } from 'azure-devops-node-api/CoreApi';
import { IPolicyApi } from 'azure-devops-node-api/PolicyApi';
import * as hostRules from '../../util/host-rules';

const hostType = 'azure';
let endpoint: string;

export function azureObj(): azure.WebApi {
  const config = hostRules.find({ hostType, url: endpoint });
  if (!(config && config.token)) {
    throw new Error(`No token found for azure`);
  }
  const authHandler = azure.getPersonalAccessTokenHandler(config.token);
  return new azure.WebApi(endpoint, authHandler);
}

export function gitApi(): Promise<IGitApi> {
  return azureObj().getGitApi();
}

export function coreApi(): Promise<ICoreApi> {
  return azureObj().getCoreApi();
}

export function policyApi(): Promise<IPolicyApi> {
  return azureObj().getPolicyApi();
}

export function setEndpoint(e: string): void {
  endpoint = e;
}
