import * as customManager from '.';

describe('modules/manager/custom/index', () => {
  it('gets something', () => {
    expect(customManager.get('regex', 'extractPackageFile')).not.toBeNull();
  });

  it('getCustomManagerList', () => {
    expect(customManager.getCustomManagerList()).not.toBeNull();
  });

  describe('isCustomManager()', () => {
    expect(customManager.isCustomManager('npm')).toBe(false);
    expect(customManager.isCustomManager('regex')).toBe(true);
  });
});
