import * as azure from 'azure-devops-node-api';
import {
  getBasicHandler,
  getBearerHandler,
  getPersonalAccessTokenHandler,
} from 'azure-devops-node-api';
import type { ClientApiBase } from 'azure-devops-node-api/ClientApiBases.js';
import type { ICoreApi } from 'azure-devops-node-api/CoreApi.js';
import type { IGitApi } from 'azure-devops-node-api/GitApi.js';
import { DeploymentFlags } from 'azure-devops-node-api/interfaces/common/VSSInterfaces.js';
import type {
  IRequestHandler,
  IRequestOptions,
} from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces.js';
import type { IPolicyApi } from 'azure-devops-node-api/PolicyApi.js';
import type { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi.js';
import { logger } from '../../../logger/index.ts';
import type { HostRule } from '../../../types/index.ts';
import { toSha256 } from '../../../util/hash.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { isProbablyJwt } from '../../../util/http/jwt.ts';

const hostType = 'azure';
const MAX_SOCKETS = 16;
const IDLE_REBUILD_MS = 30_000;
const DISPOSE_GRACE_MS = 5 * 60_000;

interface ApiPromises {
  git?: Promise<IGitApi>;
  core?: Promise<ICoreApi>;
  policy?: Promise<IPolicyApi>;
  workItemTracking?: Promise<IWorkItemTrackingApi>;
}

interface MemoEntry {
  key: string;
  webApi: azure.WebApi;
  apis: ApiPromises;
  lastUsed: number;
}

interface RetiredEntry {
  entry: MemoEntry;
  retiredAt: number;
}

let endpoint: string;
let memo: MemoEntry | undefined;
let retiredEntries: RetiredEntry[] = [];

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

function createWebApi(config: HostRule): azure.WebApi {
  if (!config.token && !(config.username && config.password)) {
    throw new Error(`No config found for azure`);
  }
  const authHandler = getAuthenticationHandler(config);
  const options: IRequestOptions = {
    allowRetries: true,
    maxRetries: 2,
  };
  if (config.keepAlive) {
    options.keepAlive = true;
    options.maxSockets = MAX_SOCKETS;
  }
  return new azure.WebApi(endpoint, authHandler, options);
}

function disposeApi(api: ClientApiBase): void {
  api.http.dispose();
  api.rest.client.dispose();
}

function disposeEntry(entry: MemoEntry): void {
  entry.webApi.rest.client.dispose();
  const apis: Promise<ClientApiBase>[] = Object.values(entry.apis);
  for (const api of apis) {
    // a rejected API promise was already reported to its caller and holds no clients
    void api.then(disposeApi, () => undefined);
  }
}

function disposeExpiredEntries(now: number): void {
  const remaining: RetiredEntry[] = [];
  for (const retired of retiredEntries) {
    if (retired.retiredAt + DISPOSE_GRACE_MS <= now) {
      disposeEntry(retired.entry);
    } else {
      remaining.push(retired);
    }
  }
  retiredEntries = remaining;
}

function retireMemo(now: number): void {
  if (memo) {
    retiredEntries.push({ entry: memo, retiredAt: now });
    memo = undefined;
  }
}

function getMemoEntry(config: HostRule): MemoEntry {
  const now = Date.now();
  disposeExpiredEntries(now);
  const key = toSha256(
    JSON.stringify([config.token, config.username, config.password]),
  );
  if (memo?.key === key && now - memo.lastUsed <= IDLE_REBUILD_MS) {
    memo.lastUsed = now;
    return memo;
  }
  const webApi = createWebApi(config);
  retireMemo(now);
  memo = { key, webApi, apis: {}, lastUsed: now };
  return memo;
}

function getApi<K extends keyof ApiPromises>(
  name: K,
  create: (webApi: azure.WebApi) => NonNullable<ApiPromises[K]>,
): NonNullable<ApiPromises[K]> {
  const config = hostRules.find({ hostType, url: endpoint });
  if (!config.keepAlive) {
    return create(createWebApi(config));
  }
  const entry = getMemoEntry(config);
  const cached = entry.apis[name];
  if (cached) {
    return cached;
  }
  const promise = create(entry.webApi);
  entry.apis[name] = promise;
  const settled: Promise<ClientApiBase> = promise;
  // the caller receives the rejection; evicting it from its own entry leaves newer entries untouched
  void settled.catch(() => {
    delete entry.apis[name];
  });
  return promise;
}

export function azureObj(credentials?: HostRule): azure.WebApi {
  const config = credentials ?? hostRules.find({ hostType, url: endpoint });
  if (credentials || !config.keepAlive) {
    return createWebApi(config);
  }
  return getMemoEntry(config).webApi;
}

export function gitApi(credentials?: HostRule): Promise<IGitApi> {
  if (credentials) {
    return azureObj(credentials).getGitApi();
  }
  return getApi('git', (webApi) => webApi.getGitApi());
}

export function coreApi(): Promise<ICoreApi> {
  return getApi('core', (webApi) => webApi.getCoreApi());
}

export function policyApi(): Promise<IPolicyApi> {
  return getApi('policy', (webApi) => webApi.getPolicyApi());
}

export function workItemTrackingApi(): Promise<IWorkItemTrackingApi> {
  return getApi('workItemTracking', (webApi) =>
    webApi.getWorkItemTrackingApi(),
  );
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
  retireMemo(Date.now());
}
