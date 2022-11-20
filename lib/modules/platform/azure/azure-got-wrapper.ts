import * as azure from 'azure-devops-node-api';
import { getBasicHandler, getHandlerFromToken } from 'azure-devops-node-api';
import type { ICoreApi } from 'azure-devops-node-api/CoreApi';
import type { IGitApi } from 'azure-devops-node-api/GitApi';
import type { IPolicyApi } from 'azure-devops-node-api/PolicyApi';
import type { IRequestHandler } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
import type { HostRule } from '../../../types';
import * as hostRules from '../../../util/host-rules';

const hostType = 'azure';
let endpoint: string;

function getAuthenticationHandler(config: HostRule): IRequestHandler {
  if (!config.token && config.username && config.password) {
    return getBasicHandler(config.username, config.password, true);
  }
  // TODO: token can be undefined here (#7154)
  return getHandlerFromToken(config.token!, true);
}

export function azureObj(): azure.WebApi {
  const config = hostRules.find({ hostType, url: endpoint });
  if (!config.token && !(config.username && config.password)) {
    throw new Error(`No config found for azure`);
  }
  const authHandler = getAuthenticationHandler(config);
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
