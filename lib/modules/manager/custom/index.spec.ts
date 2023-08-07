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

  it('gets supportedDatasources', () => {
    expect(customManager.supportedDatasources).toEqual(['*']);
  });

  it('extractPackageFile', () => {
    expect(customManager.extractPackageFile('', '', {})).toEqual({ deps: [] });
  });
});
