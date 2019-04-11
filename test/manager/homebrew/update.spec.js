const { updateDependency } = require('../../../lib/manager/homebrew/update');

describe('manager/homebrew/update', () => {
  describe('updateDependency()', () => {
    it('returns null (STUB)', () => {
      expect(updateDependency('', {})).toBeNull();
    });
  });
});
