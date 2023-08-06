import * as customManager from '.';

describe('modules/manager/custom/index', () => {
  it('has default config', () => {
    expect(customManager.defaultConfig).toEqual({});
  });

  it('gets supportedDatasources', () => {
    expect(customManager.supportedDatasources).toEqual(['*']);
  });

  it('extractPackageFile', () => {
    expect(customManager.extractPackageFile('', '', {})).toEqual({ deps: [] });
  });
});
