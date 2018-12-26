const { handleError } = require('../../../lib/workers/repository/error');

jest.mock('../../../lib/workers/repository/error-config');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../_fixtures/config');
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
      'rate-limit-exceeded',
      'lockfile-error',
      'disk-space',
      'platform-failure',
      'no-vulnerability-alerts',
      'cannot-fork',
      'integration-unauthorized',
    ];
    errors.forEach(err => {
      it(`errors ${err}`, async () => {
        const res = await handleError(config, new Error(err));
        expect(res).toEqual(err);
      });
    });
    it('handles unknown error', async () => {
      const res = await handleError(config, new Error('abcdefg'));
      expect(res).toEqual('unknown-error');
    });
  });
});
