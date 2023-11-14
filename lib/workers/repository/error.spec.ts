import { RenovateConfig, partial } from '../../../test/util';
import {
  CONFIG_SECRETS_EXPOSED,
  CONFIG_VALIDATION,
  EXTERNAL_HOST_ERROR,
  MANAGER_LOCKFILE_ERROR,
  MISSING_API_CREDENTIALS,
  NO_VULNERABILITY_ALERTS,
  PLATFORM_AUTHENTICATION_ERROR,
  PLATFORM_BAD_CREDENTIALS,
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
  REPOSITORY_NOT_FOUND,
  REPOSITORY_NO_PACKAGE_FILES,
  REPOSITORY_RENAMED,
  REPOSITORY_UNINITIATED,
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  SYSTEM_INSUFFICIENT_MEMORY,
  TEMPORARY_ERROR,
  UNKNOWN_ERROR,
} from '../../constants/error-messages';
import { ExternalHostError } from '../../types/errors/external-host-error';
import handleError from './error';

jest.mock('./error-config');

let config: RenovateConfig;

beforeEach(() => {
  config = partial<RenovateConfig>({ branchList: [] });
});

describe('workers/repository/error', () => {
  describe('handleError()', () => {
    const errors = [
      REPOSITORY_UNINITIATED,
      REPOSITORY_EMPTY,
      REPOSITORY_DISABLED,
      REPOSITORY_CHANGED,
      REPOSITORY_FORKED,
      REPOSITORY_NO_PACKAGE_FILES,
      CONFIG_SECRETS_EXPOSED,
      CONFIG_VALIDATION,
      REPOSITORY_ARCHIVED,
      REPOSITORY_MIRRORED,
      REPOSITORY_RENAMED,
      REPOSITORY_BLOCKED,
      REPOSITORY_NOT_FOUND,
      REPOSITORY_ACCESS_FORBIDDEN,
      PLATFORM_BAD_CREDENTIALS,
      PLATFORM_RATE_LIMIT_EXCEEDED,
      MANAGER_LOCKFILE_ERROR,
      MISSING_API_CREDENTIALS,
      SYSTEM_INSUFFICIENT_DISK_SPACE,
      SYSTEM_INSUFFICIENT_MEMORY,
      NO_VULNERABILITY_ALERTS,
      REPOSITORY_CANNOT_FORK,
      PLATFORM_INTEGRATION_UNAUTHORIZED,
      PLATFORM_AUTHENTICATION_ERROR,
      TEMPORARY_ERROR,
    ];
    errors.forEach((err) => {
      it(`errors ${err}`, async () => {
        const res = await handleError(config, new Error(err));
        expect(res).toEqual(err);
      });
    });

    it(`handles ExternalHostError`, async () => {
      const res = await handleError(
        config,
        new ExternalHostError(new Error(), 'some-host-type'),
      );
      expect(res).toEqual(EXTERNAL_HOST_ERROR);
    });

    it('rewrites git 5xx error', async () => {
      const gitError = new Error(
        "fatal: unable to access 'https://**redacted**@gitlab.com/learnox/learnox.git/': The requested URL returned error: 500\n",
      );
      const res = await handleError(config, gitError);
      expect(res).toEqual(EXTERNAL_HOST_ERROR);
    });

    it('rewrites git remote error', async () => {
      const gitError = new Error(
        'fatal: remote error: access denied or repository not exported: /b/nw/bd/27/47/159945428/108610112.git\n',
      );
      const res = await handleError(config, gitError);
      expect(res).toEqual(EXTERNAL_HOST_ERROR);
    });

    it('rewrites git fatal error', async () => {
      const gitError = new Error(
        'fatal: not a git repository (or any parent up to mount point /mnt)\nStopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).\n',
      );
      const res = await handleError(config, gitError);
      expect(res).toEqual(TEMPORARY_ERROR);
    });

    it('handles unknown error', async () => {
      const res = await handleError(config, new Error('abcdefg'));
      expect(res).toEqual(UNKNOWN_ERROR);
    });
  });
});
