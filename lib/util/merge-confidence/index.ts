import is from '@sindresorhus/is';
import type { UpdateType } from '../../config/types';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../cache/package';
import * as hostRules from '../host-rules';
import { Http } from '../http';
import { MERGE_CONFIDENCE } from './common';
import type { MergeConfidence } from './types';

const hostType = 'merge-confidence';
const http = new Http(hostType);
let token: string | undefined;
let apiBaseUrl: string | undefined;

const supportedDatasources = ['npm', 'maven', 'pypi'];

export const confidenceLevels: Record<MergeConfidence, number> = {
  low: -1,
  neutral: 0,
  high: 1,
  'very high': 2,
};

export function initConfig(): void {
  apiBaseUrl = getApiBaseUrl();
  token = getApiToken();
  if (!is.nullOrUndefined(token)) {
    logger.debug(`Merge confidence token found for ${apiBaseUrl}`);
  }
}

export function resetConfig(): void {
  token = undefined;
  apiBaseUrl = undefined;
}

export function isMergeConfidence(value: string): value is MergeConfidence {
  return MERGE_CONFIDENCE.includes(value as MergeConfidence);
}

export function isActiveConfidenceLevel(confidence: string): boolean {
  return isMergeConfidence(confidence) && confidence !== 'low';
}

export function satisfiesConfidenceLevel(
  confidence: MergeConfidence,
  minimumConfidence: MergeConfidence,
): boolean {
  return confidenceLevels[confidence] >= confidenceLevels[minimumConfidence];
}

const updateTypeConfidenceMapping: Record<UpdateType, MergeConfidence | null> =
  {
    pin: 'high',
    digest: 'neutral',
    pinDigest: 'high',
    bump: 'neutral',
    lockFileMaintenance: 'neutral',
    lockfileUpdate: 'neutral',
    rollback: 'neutral',
    replacement: 'neutral',
    major: null,
    minor: null,
    patch: null,
  };

/**
 * Retrieves the merge confidence of a package update if the merge confidence API is enabled. Otherwise, undefined is returned.
 *
 * @param datasource
 * @param packageName
 * @param currentVersion
 * @param newVersion
 * @param updateType
 *
 * @returns The merge confidence level for the given package release.
 * @throws {ExternalHostError} If a request has been made and an error occurs during the request, such as a timeout, connection reset, authentication failure, or internal server error.
 */
export async function getMergeConfidenceLevel(
  datasource: string,
  packageName: string,
  currentVersion: string,
  newVersion: string,
  updateType: UpdateType,
): Promise<MergeConfidence | undefined> {
  if (is.nullOrUndefined(apiBaseUrl) || is.nullOrUndefined(token)) {
    return undefined;
  }

  if (!supportedDatasources.includes(datasource)) {
    return undefined;
  }

  if (!(currentVersion && newVersion && updateType)) {
    return 'neutral';
  }

  const mappedConfidence = updateTypeConfidenceMapping[updateType];
  if (mappedConfidence) {
    return mappedConfidence;
  }

  return await queryApi(datasource, packageName, currentVersion, newVersion);
}

/**
 * Queries the Merge Confidence API with the given package release information.
 *
 * @param datasource
 * @param packageName
 * @param currentVersion
 * @param newVersion
 *
 * @returns The merge confidence level for the given package release.
 * @throws {ExternalHostError} if a timeout or connection reset error, authentication failure, or internal server error occurs during the request.
 *
 * @remarks
 * Results are cached for 60 minutes to reduce the number of API calls.
 */
async function queryApi(
  datasource: string,
  packageName: string,
  currentVersion: string,
  newVersion: string,
): Promise<MergeConfidence> {
  // istanbul ignore if: defensive, already been validated before calling this function
  if (is.nullOrUndefined(apiBaseUrl) || is.nullOrUndefined(token)) {
    return 'neutral';
  }

  const escapedPackageName = packageName.replace('/', '%2f');
  const url = `${apiBaseUrl}api/mc/json/${datasource}/${escapedPackageName}/${currentVersion}/${newVersion}`;
  const cacheKey = `${token}:${url}`;
  const cachedResult = await packageCache.get(hostType, cacheKey);

  // istanbul ignore if
  if (cachedResult) {
    logger.debug(
      {
        datasource,
        packageName,
        currentVersion,
        newVersion,
        cachedResult,
      },
      'using merge confidence cached result',
    );
    return cachedResult;
  }

  let confidence: MergeConfidence = 'neutral';
  try {
    const res = (await http.getJson<{ confidence: MergeConfidence }>(url)).body;
    if (isMergeConfidence(res.confidence)) {
      confidence = res.confidence;
    }
  } catch (err) {
    apiErrorHandler(err);
  }

  await packageCache.set(hostType, cacheKey, confidence, 60);
  return confidence;
}

/**
 * Checks the health of the Merge Confidence API by attempting to authenticate with it.
 *
 * @returns Resolves when the API health check is completed successfully.
 *
 * @throws {ExternalHostError} if a timeout, connection reset error, authentication failure, or internal server error occurs during the request.
 *
 * @remarks
 * This function first checks that the API base URL and an authentication bearer token are defined before attempting to
 * authenticate with the API. If either the base URL or token is not defined, it will immediately return
 * without making a request.
 */
export async function initMergeConfidence(): Promise<void> {
  initConfig();

  if (is.nullOrUndefined(apiBaseUrl) || is.nullOrUndefined(token)) {
    logger.trace('merge confidence API usage is disabled');
    return;
  }

  const url = `${apiBaseUrl}api/mc/availability`;
  try {
    await http.get(url);
  } catch (err) {
    apiErrorHandler(err);
  }

  logger.debug('merge confidence API - successfully authenticated');
  return;
}

function getApiBaseUrl(): string {
  const defaultBaseUrl = 'https://developer.mend.io/';
  const baseFromEnv = process.env.RENOVATE_X_MERGE_CONFIDENCE_API_BASE_URL;

  if (is.nullOrUndefined(baseFromEnv)) {
    logger.trace('using default merge confidence API base URL');
    return defaultBaseUrl;
  }

  try {
    const parsedBaseUrl = new URL(baseFromEnv).toString();
    logger.trace(
      { baseUrl: parsedBaseUrl },
      'using merge confidence API base found in environment variables',
    );
    return parsedBaseUrl;
  } catch (err) {
    logger.warn(
      { err, baseFromEnv },
      'invalid merge confidence API base URL found in environment variables - using default value instead',
    );
    return defaultBaseUrl;
  }
}

export function getApiToken(): string | undefined {
  return hostRules.find({
    url: apiBaseUrl,
    hostType,
  })?.token;
}

/**
 * Handles errors returned by the Merge Confidence API.
 *
 * @param err - The error object returned by the API.
 * @throws {ExternalHostError} if a timeout or connection reset error, authentication failure, or internal server error occurs during the request.
 */
function apiErrorHandler(err: any): void {
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
    logger.error({ err }, 'merge confidence API request failed - aborting run');
    throw new ExternalHostError(err, hostType);
  }

  if (err.statusCode === 403) {
    logger.error({ err }, 'merge confidence API token rejected - aborting run');
    throw new ExternalHostError(err, hostType);
  }

  if (err.statusCode >= 500 && err.statusCode < 600) {
    logger.error({ err }, 'merge confidence API failure: 5xx - aborting run');
    throw new ExternalHostError(err, hostType);
  }

  logger.warn({ err }, 'error fetching merge confidence data');
}
