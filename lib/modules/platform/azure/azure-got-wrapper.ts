import * as azure from 'azure-devops-node-api';
import {
  getBasicHandler,
  getBearerHandler,
  getHandlerFromToken,
  getPersonalAccessTokenHandler,
} from 'azure-devops-node-api';
import type { ICoreApi } from 'azure-devops-node-api/CoreApi.js';
import type { IGitApi } from 'azure-devops-node-api/GitApi.js';
import type { IRequestHandler } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces.js';
import type { IPolicyApi } from 'azure-devops-node-api/PolicyApi.js';
import { GlobalConfig } from '../../../config/global.ts';
import type { HostRule } from '../../../types/index.ts';
import * as hostRules from '../../../util/host-rules.ts';

const hostType = 'azure';
let endpoint: string;

function getAuthenticationHandler(config: HostRule): IRequestHandler {
  if (!config.token && config.username && config.password) {
    return getBasicHandler(config.username, config.password, true);
  }
  const azureAuthType = GlobalConfig.get('azureAuthType', 'auto');
  if (azureAuthType === 'bearer') {
    return getBearerHandler(config.token!, true);
  }
  if (azureAuthType === 'pat') {
    return getPersonalAccessTokenHandler(config.token!, true);
  }
  // 'auto' — delegate to azure-devops-node-api library heuristic
  // TODO: token can be undefined here (#22198)
  return getHandlerFromToken(config.token!, true);
}

export function azureObj(): azure.WebApi {
  const config = hostRules.find({ hostType, url: endpoint });
  if (!config.token && !(config.username && config.password)) {
    throw new Error(`No config found for azure`);
  }
  const authHandler = getAuthenticationHandler(config);
  return new azure.WebApi(endpoint, authHandler, {
    allowRetries: true,
    maxRetries: 2,
  });
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
