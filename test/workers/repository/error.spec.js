const { handleError } = require('../../../lib/workers/repository/error');

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
      'fork',
      'no-package-files',
      'loops>5',
    ];
    errors.forEach(err => {
      it(`errors ${err}`, () => {
        const res = handleError(config, new Error(err));
        expect(res).toEqual(err);
      });
    });
    it('handles unknown error', () => {
      const res = handleError(config, new Error('abcdefg'));
      expect(res).toEqual('unknown-error');
    });
  });
});
