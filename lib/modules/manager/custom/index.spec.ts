import * as customManager from '.';

describe('modules/manager/custom/index', () => {
  it('has default config', () => {
    expect(customManager.defaultConfig).toEqual({});
  });

  it('gets something', () => {
    expect(customManager.get('regex', 'extractPackageFile')).not.toBeNull();
  });

  it('getCustomManagerList', () => {
    expect(customManager.getCustomManagerList()).not.toBeNull();
  });

  // for coverage
  it('extractPackageFile', () => {
    expect(customManager.extractPackageFile('', '', {})).toEqual({ deps: [] });
  });
});
