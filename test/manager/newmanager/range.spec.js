const { getRangeStrategy } = require('../../../lib/manager/newmanager');

describe('lib/manager/newmanager/range', () => {
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
