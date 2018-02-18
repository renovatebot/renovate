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
      'disabled',
      'repository-changed',
      'fork',
      'no-package-files',
      'loops>5',
      'config-validation',
      'registry-failure',
      'archived',
      'renamed',
      'blocked',
      'not-found',
      'forbidden',
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
