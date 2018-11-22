const { updateDependency } = require('../../../lib/manager/newmanager/update');

describe('lib/manager/newmanager/update', () => {
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
