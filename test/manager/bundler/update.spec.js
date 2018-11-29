const { updateDependency } = require('../../../lib/manager/bundler/update');

describe('lib/manager/bundler/update', () => {
  describe('updateDependency()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns same', () => {
      expect(updateDependency('abc', config)).toEqual('abc');
    });
  });
});
