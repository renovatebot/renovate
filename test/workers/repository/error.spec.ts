import handleError from '../../../lib/workers/repository/error';
import {
  CONFIG_VALIDATION,
  DATASOURCE_FAILURE,
  MANAGER_LOCKFILE_ERROR,
  MANAGER_NO_PACKAGE_FILES,
  PLATFORM_AUTHENTICATION_ERROR,
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_FAILURE,
  PLATFORM_INTEGRATION_UNAUTHORIZED,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_ARCHIVED,
  REPOSITORY_BLOCKED,
  REPOSITORY_CANNOT_FORK,
  REPOSITORY_CHANGED,
  REPOSITORY_DISABLED,
  REPOSITORY_EMPTY,
  REPOSITORY_FORKED,
  REPOSITORY_MIRRORED,
  REPOSITORY_NO_VULNERABILITY,
  REPOSITORY_NOT_FOUND,
  REPOSITORY_RENAMED,
  REPOSITORY_TEMPORARY_ERROR,
  REPOSITORY_UNINITIATED,
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  UNKNOWN_ERROR,
} from '../../../lib/constants/error-messages';
import { RenovateConfig, getConfig } from '../../util';

jest.mock('../../../lib/workers/repository/error-config');

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig;
});

describe('workers/repository/error', () => {
  describe('handleError()', () => {
    const errors = [
      REPOSITORY_UNINITIATED,
      REPOSITORY_EMPTY,
      REPOSITORY_DISABLED,
      REPOSITORY_CHANGED,
      REPOSITORY_FORKED,
      MANAGER_NO_PACKAGE_FILES,
      CONFIG_VALIDATION,
      DATASOURCE_FAILURE,
      REPOSITORY_ARCHIVED,
      REPOSITORY_MIRRORED,
      REPOSITORY_RENAMED,
      REPOSITORY_BLOCKED,
      REPOSITORY_NOT_FOUND,
      REPOSITORY_ACCESS_FORBIDDEN,
      PLATFORM_BAD_CREDENTIALS,
      PLATFORM_RATE_LIMIT_EXCEEDED,
      MANAGER_LOCKFILE_ERROR,
      SYSTEM_INSUFFICIENT_DISK_SPACE,
      PLATFORM_FAILURE,
      REPOSITORY_NO_VULNERABILITY,
      REPOSITORY_CANNOT_FORK,
      PLATFORM_INTEGRATION_UNAUTHORIZED,
      PLATFORM_AUTHENTICATION_ERROR,
      REPOSITORY_TEMPORARY_ERROR,
    ];
    errors.forEach(err => {
      it(`errors ${err}`, async () => {
        const res = await handleError(config, new Error(err));
        expect(res).toEqual(err);
      });
    });
    it('rewrites git 5xx error', async () => {
      const gitError = new Error(
        "fatal: unable to access 'https://**redacted**@gitlab.com/learnox/learnox.git/': The requested URL returned error: 500\n"
      );
      const res = await handleError(config, gitError);
      expect(res).toEqual(PLATFORM_FAILURE);
    });
    it('rewrites git remote error', async () => {
      const gitError = new Error(
        'fatal: remote error: access denied or repository not exported: /b/nw/bd/27/47/159945428/108610112.git\n'
      );
      const res = await handleError(config, gitError);
      expect(res).toEqual(PLATFORM_FAILURE);
    });
    it('handles unknown error', async () => {
      const res = await handleError(config, new Error('abcdefg'));
      expect(res).toEqual(UNKNOWN_ERROR);
    });
  });
});
