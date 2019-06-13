const { handleError } = require('../../../lib/workers/repository/error');

jest.mock('../../../lib/workers/repository/error-config');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../config/config/_fixtures');
});

describe('workers/repository/error', () => {
  describe('handleError()', () => {
    const errors = [
      'uninitiated',
      'empty',
      'disabled',
      'repository-changed',
      'fork',
      'no-package-files',
      'config-validation',
      'registry-failure',
      'archived',
      'renamed',
      'blocked',
      'not-found',
      'forbidden',
      'bad-credentials',
      'rate-limit-exceeded',
      'lockfile-error',
      'disk-space',
      'platform-failure',
      'no-vulnerability-alerts',
      'cannot-fork',
      'integration-unauthorized',
      'authentication-error',
      'temporary-error',
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
      expect(res).toEqual('platform-failure');
    });
    it('rewrites git remote error', async () => {
      const gitError = new Error(
        'fatal: remote error: access denied or repository not exported: /b/nw/bd/27/47/159945428/108610112.git\n'
      );
      const res = await handleError(config, gitError);
      expect(res).toEqual('platform-failure');
    });
    it('handles unknown error', async () => {
      const res = await handleError(config, new Error('abcdefg'));
      expect(res).toEqual('unknown-error');
    });
  });
});
