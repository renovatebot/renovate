import * as customManager from '.';

describe('modules/manager/custom/index', () => {
  it('getCustomManagerList', () => {
    expect(customManager.customManagerList).not.toBeNull();
  });

  describe('isCustomManager()', () => {
    it('works', () => {
      expect(customManager.isCustomManager('npm')).toBe(false);
      expect(customManager.isCustomManager('regex')).toBe(true);
    });
  });
});
