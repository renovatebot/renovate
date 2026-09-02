import * as azure from 'azure-devops-node-api';
import {
  getBasicHandler,
  getBearerHandler,
  getPersonalAccessTokenHandler,
} from 'azure-devops-node-api';
import type { ICoreApi } from 'azure-devops-node-api/CoreApi.js';
import type { IGitApi } from 'azure-devops-node-api/GitApi.js';
import { DeploymentFlags } from 'azure-devops-node-api/interfaces/common/VSSInterfaces.js';
import type { IRequestHandler } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces.js';
import type { IPolicyApi } from 'azure-devops-node-api/PolicyApi.js';
import type { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi.js';
import { logger } from '../../../logger/index.ts';
import type { HostRule } from '../../../types/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { isProbablyJwt } from '../../../util/http/jwt.ts';

const hostType = 'azure';
let endpoint: string;

function getAuthenticationHandler(config: HostRule): IRequestHandler {
  if (!config.token && config.username && config.password) {
    return getBasicHandler(config.username, config.password, true);
  }
  if (config.token && isProbablyJwt(config.token)) {
    logger.debug('Using Bearer authentication (JWT detected)');
    return getBearerHandler(config.token, true);
  }
  logger.debug('Using PAT authentication');
  // TODO: token can be undefined here (#22198)
  return getPersonalAccessTokenHandler(config.token!, true);
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

export function workItemTrackingApi(): Promise<IWorkItemTrackingApi> {
  return azureObj().getWorkItemTrackingApi();
}

/**
 * Whether the endpoint is Azure DevOps Services (cloud) rather than Azure
 * DevOps Server (on-premises). Read from the location service's
 * `_apis/connectionData`, which reports the deployment type authoritatively.
 * Defaults to `false` (on-premises) when the type cannot be determined, so
 * callers stay on the behaviour that both products support.
 */
export async function isHosted(): Promise<boolean> {
  try {
    const { deploymentType } = await azureObj().connect();
    // `connect()` returns the response body as-is, without running the SDK
    // deserializer, so enums arrive as their name (`hosted`) instead of their
    // numeric value. Accept both forms.
    return (
      deploymentType === DeploymentFlags.Hosted ||
      String(deploymentType).toLowerCase() === 'hosted'
    );
  } catch (err) {
    logger.debug(
      { err },
      'Azure: could not determine deployment type, assuming on-premises',
    );
    return false;
  }
}

export function setEndpoint(e: string): void {
  endpoint = e;
}
