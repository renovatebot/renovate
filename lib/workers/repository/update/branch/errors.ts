import {
  CONFIG_VALIDATION,
  MANAGER_LOCKFILE_ERROR,
  PLATFORM_AUTHENTICATION_ERROR,
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  PR_ALREADY_IN_MERGE_QUEUE,
  REPOSITORY_CHANGED,
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
  WORKER_FILE_UPDATE_FAILED,
} from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { ExternalHostError } from '../../../../types/errors/external-host-error.ts';
import type { ProcessBranchResult } from './types.ts';

export interface BranchErrorContext {
  branchExists: boolean;
  prNo?: number;
  commitSha: string | null;
  updatesVerified: boolean;
}

/**
 * Decides how an error thrown while updating a branch is handled: errors which
 * must abort the run are (re)thrown, all others are mapped to a branch result
 * so that the remaining branches can still be processed.
 */
export function handleBranchError(
  err: any,
  { branchExists, prNo, commitSha, updatesVerified }: BranchErrorContext,
): ProcessBranchResult {
  if (err.statusCode === 404) {
    logger.debug({ err }, 'Received a 404 error - aborting run');
    throw new Error(REPOSITORY_CHANGED);
  }
  if (err.message === PLATFORM_RATE_LIMIT_EXCEEDED) {
    logger.debug('Passing rate-limit-exceeded error up');
    throw err;
  }
  if (err.message === REPOSITORY_CHANGED) {
    logger.debug('Passing repository-changed error up');
    throw err;
  }
  if (err.message?.startsWith('remote: Invalid username or password')) {
    logger.debug('Throwing bad credentials');
    throw new Error(PLATFORM_BAD_CREDENTIALS);
  }
  if (
    err.message?.startsWith(
      'ssh_exchange_identification: Connection closed by remote host',
    )
  ) {
    logger.debug('Throwing bad credentials');
    throw new Error(PLATFORM_BAD_CREDENTIALS);
  }
  if (err.message === PLATFORM_BAD_CREDENTIALS) {
    logger.debug('Passing bad-credentials error up');
    throw err;
  }
  if (err.message === PLATFORM_INTEGRATION_UNAUTHORIZED) {
    logger.debug('Passing integration-unauthorized error up');
    throw err;
  }
  if (err.message === MANAGER_LOCKFILE_ERROR) {
    logger.debug('Passing lockfile-error up');
    throw err;
  }
  if (err.message === PR_ALREADY_IN_MERGE_QUEUE) {
    logger.debug('Branch PR is in the merge queue - skipping branch update');
    return {
      branchExists,
      prNo,
      result: 'done',
      commitSha,
    };
  }
  if (err.message?.includes('space left on device')) {
    throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
  }
  if (err.message === SYSTEM_INSUFFICIENT_DISK_SPACE) {
    logger.debug('Passing disk-space error up');
    throw err;
  }
  if (err.message.startsWith('Resource not accessible by integration')) {
    logger.debug('Passing 403 error up');
    throw err;
  }
  if (err.message === WORKER_FILE_UPDATE_FAILED) {
    logger.warn('Error updating branch: update failure');
  } else if (err.message.startsWith('bundler-')) {
    // we have already warned inside the bundler artifacts error handling, so just return
    return {
      branchExists: true,
      updatesVerified,
      prNo,
      result: 'error',
      commitSha,
    };
  } else if (err.message?.includes('fatal: Authentication failed')) {
    throw new Error(PLATFORM_AUTHENTICATION_ERROR);
  } else if (err.message?.includes('fatal: bad revision')) {
    logger.debug({ err }, 'Aborting job due to bad revision error');
    throw new Error(REPOSITORY_CHANGED);
  } else if (err.message === CONFIG_VALIDATION) {
    logger.debug('Passing config validation error up');
    throw err;
  } else if (err.message === TEMPORARY_ERROR) {
    logger.debug('Passing TEMPORARY_ERROR error up');
    throw err;
  } else if (!(err instanceof ExternalHostError)) {
    logger.warn({ err }, `Error updating branch`);
  }
  // Don't throw here - we don't want to stop the other renovations
  return {
    branchExists,
    prNo,
    result: 'error',
    commitSha,
  };
}
