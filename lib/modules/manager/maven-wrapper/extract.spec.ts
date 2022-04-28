import { loadFixture } from '../../../../test/util';
import { extractPackageFile } from './extract';

const typeBinFileContent = loadFixture(
  'wrapper-and-maven/maven-wrapper.properties'
);
const onlyWrapperProperties = loadFixture(
  'only-wrapper/maven-wrapper.properties'
);
const onlyMavenProperties = loadFixture('only-maven/maven-wrapper.properties');

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
          depName: 'org.apache.maven:apache-maven',
          versioning: 'maven',
        },
        {
          currentValue: '3.1.0',
          replaceString:
            'https://artifactory.tools.bol.com/artifactory/maven-bol/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar',
          datasource: 'maven',
          depName: 'org.apache.maven.wrapper:maven-wrapper',
          versioning: 'maven',
        },
      ]);
    });
    // takari or maven wrapper ??
    it('extracts version for property file with only a wrapper url', () => {
      const res = extractPackageFile(onlyWrapperProperties);
      expect(res.deps).toEqual([
        {
          currentValue: '0.5.6',
          replaceString:
            'https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar',
          datasource: 'maven',
          depName: 'org.apache.maven.wrapper:maven-wrapper',
          versioning: 'maven',
        },
      ]);
    });

    it('extracts version for property file with only a maven url', () => {
      const res = extractPackageFile(onlyMavenProperties);
      expect(res.deps).toEqual([
        {
          currentValue: '3.5.4',
          replaceString:
            'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.5.4/apache-maven-3.5.4-bin.zip',
          datasource: 'maven',
          depName: 'org.apache.maven:apache-maven',
          versioning: 'maven',
        },
      ]);
    });
  });
});
