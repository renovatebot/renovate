import { isMavenCentral } from './common.ts';

describe('modules/datasource/maven/common', () => {
  describe('isMavenCentralUrl', () => {
    it.each([
      ['https://repo.maven.apache.org/maven2', true],
      ['http://repo.maven.apache.org/maven2', true],
      ['https://repo1.maven.org/maven2', true],
      ['http://repo1.maven.org/maven2', true],
      // we currently only support host-based checks
      ['http://repo1.maven.org/maven200', true],
      ['ftp://repo1.maven.org/maven2', true],

      // invalid URLs
      ['http://repo55.maven.apache.org/maven2', false],
      ['https://some-artifactory.local/maven2', false],
    ])('%s => %s', (url: string, expected: boolean) => {
      expect(isMavenCentral(url)).toEqual(expected);
    });
  });
});
