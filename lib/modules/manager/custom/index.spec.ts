import * as customManager from '.';

describe('modules/manager/custom/index', () => {
  it('getCustomManagerList', () => {
    expect(customManager.customManagerList).toBeArrayOf(expect.toBeString());
  });

  describe('isCustomManager()', () => {
    it('works', () => {
      expect(customManager.isCustomManager('npm')).toBe(false);
      expect(customManager.isCustomManager('regex')).toBe(true);
      expect(customManager.isCustomManager('custom.regex')).toBe(false);
    });
  });
});
