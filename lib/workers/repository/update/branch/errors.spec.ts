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
import type { BranchErrorContext } from './errors.ts';
import { handleBranchError } from './errors.ts';

describe('workers/repository/update/branch/errors', () => {
  describe('handleBranchError', () => {
    let context: BranchErrorContext;

    beforeEach(() => {
      context = {
        branchExists: true,
        prNo: 12,
        commitSha: 'abc123',
        updatesVerified: true,
      };
    });

    it('throws repository-changed for a 404 error', () => {
      const err = Object.assign(new Error('Not found'), { statusCode: 404 });
      expect(() => handleBranchError(err, context)).toThrow(REPOSITORY_CHANGED);
    });

    it.each`
      message
      ${PLATFORM_RATE_LIMIT_EXCEEDED}
      ${REPOSITORY_CHANGED}
      ${PLATFORM_BAD_CREDENTIALS}
      ${PLATFORM_INTEGRATION_UNAUTHORIZED}
      ${MANAGER_LOCKFILE_ERROR}
      ${SYSTEM_INSUFFICIENT_DISK_SPACE}
      ${CONFIG_VALIDATION}
      ${TEMPORARY_ERROR}
      ${'Resource not accessible by integration'}
    `('passes $message up', ({ message }: { message: string }) => {
      const err = new Error(message);
      expect(() => handleBranchError(err, context)).toThrow(err);
    });

    it.each`
      message                                                            | expected
      ${'remote: Invalid username or password'}                          | ${PLATFORM_BAD_CREDENTIALS}
      ${'ssh_exchange_identification: Connection closed by remote host'} | ${PLATFORM_BAD_CREDENTIALS}
      ${'No space left on device'}                                       | ${SYSTEM_INSUFFICIENT_DISK_SPACE}
      ${'fatal: Authentication failed for some repo'}                    | ${PLATFORM_AUTHENTICATION_ERROR}
      ${'fatal: bad revision'}                                           | ${REPOSITORY_CHANGED}
    `(
      'maps $message to $expected',
      ({ message, expected }: { message: string; expected: string }) => {
        const err = new Error(message);
        expect(() => handleBranchError(err, context)).toThrow(expected);
      },
    );

    it('returns done if the PR is in the merge queue', () => {
      const err = new Error(PR_ALREADY_IN_MERGE_QUEUE);
      expect(handleBranchError(err, context)).toEqual({
        branchExists: true,
        prNo: 12,
        result: 'done',
        commitSha: 'abc123',
      });
    });

    it('returns error for a bundler artifact error', () => {
      const err = new Error('bundler-2');
      expect(handleBranchError(err, context)).toEqual({
        branchExists: true,
        updatesVerified: true,
        prNo: 12,
        result: 'error',
        commitSha: 'abc123',
      });
    });

    it('warns and returns error for a file update failure', () => {
      const err = new Error(WORKER_FILE_UPDATE_FAILED);
      expect(handleBranchError(err, context)).toEqual({
        branchExists: true,
        prNo: 12,
        result: 'error',
        commitSha: 'abc123',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Error updating branch: update failure',
      );
    });

    it('does not warn for an external host error', () => {
      const err = new ExternalHostError(new Error('some error'));
      expect(handleBranchError(err, context)).toEqual({
        branchExists: true,
        prNo: 12,
        result: 'error',
        commitSha: 'abc123',
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('warns and returns error for any other error', () => {
      const err = new Error('some unknown error');
      expect(
        handleBranchError(err, {
          branchExists: false,
          commitSha: null,
          updatesVerified: false,
        }),
      ).toEqual({
        branchExists: false,
        prNo: undefined,
        result: 'error',
        commitSha: null,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        { err },
        'Error updating branch',
      );
    });
  });
});
