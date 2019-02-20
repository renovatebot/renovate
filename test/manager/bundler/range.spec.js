const { getRangeStrategy } = require('../../../lib/manager/bundler');

describe('lib/manager/bundler/range', () => {
  describe('getRangeStrategy()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('always returns replace', () => {
      expect(getRangeStrategy(config)).toEqual('replace');
    });
  });
});
