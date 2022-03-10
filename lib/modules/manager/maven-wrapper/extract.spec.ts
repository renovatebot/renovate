import { loadFixture } from '../../../../test/util';
import { extractPackageFile } from './extract';

const typeBinFileContent = loadFixture('maven-wrapper.properties');

describe('modules/manager/maven-wrapper/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts version for property file with distribution type "bin" in distributionUrl', () => {
      const res = extractPackageFile(typeBinFileContent);
      expect(res.deps).toEqual([
        {
          currentValue: '3.8.4',
          replaceString:
            'https://artifactory.tools.bol.com/artifactory/maven-bol/org/apache/maven/apache-maven/3.8.4/apache-maven-3.8.4-bin.zip',
          datasource: 'maven',
          depName: 'maven',
          versioning: 'maven',
        },
        {
          currentValue: '3.1.0',
          replaceString:
            'https://artifactory.tools.bol.com/artifactory/maven-bol/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0',
          datasource: 'maven-wrapper-version',
          depName: 'maven-wrapper',
          versioning: 'maven-wrapper',
        },
      ]);
    });
  });
});
