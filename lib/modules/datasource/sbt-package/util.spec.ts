import { getLatestVersion } from './util.ts';

describe('modules/datasource/sbt-package/util', () => {
  it('gets latest version', () => {
    expect(getLatestVersion(['1.0.0', '3.0.0', '2.0.0'])).toBe('3.0.0');
  });
});
