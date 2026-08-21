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
import { hash } from '../../../util/hash.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { isProbablyJwt } from '../../../util/http/jwt.ts';
import { safeStringify } from '../../../util/stringify.ts';

const hostType = 'azure';
let endpoint: string;

export interface AuthenticationContext {
  credentials: HostRule;
  key: string;
}

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

export function getAuthenticationContext(): AuthenticationContext {
  const credentials = hostRules.find({ hostType, url: endpoint });
  const key = hash(
    safeStringify([
      endpoint,
      credentials.token,
      credentials.username,
      credentials.password,
    ]),
  );
  return { credentials, key };
}

export function azureObj(credentials?: HostRule): azure.WebApi {
  const config = credentials ?? getAuthenticationContext().credentials;
  if (!config.token && !(config.username && config.password)) {
    throw new Error(`No config found for azure`);
  }
  const authHandler = getAuthenticationHandler(config);
  return new azure.WebApi(endpoint, authHandler, {
    allowRetries: true,
    maxRetries: 2,
  });
}

export function gitApi(credentials?: HostRule): Promise<IGitApi> {
  return azureObj(credentials).getGitApi();
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

export async function getAuthenticatedUserId(
  credentials: HostRule,
): Promise<string | undefined> {
  try {
    const { authenticatedUser } = await azureObj(credentials).connect();
    if (!authenticatedUser?.id) {
      logger.debug('Azure: authenticated user ID is unavailable');
    }
    return authenticatedUser?.id;
  } catch (err) {
    logger.debug({ err }, 'Azure: could not determine authenticated user ID');
    return undefined;
  }
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
    return deploymentType === DeploymentFlags.Hosted;
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
