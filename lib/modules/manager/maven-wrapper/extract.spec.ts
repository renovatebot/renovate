import { extractPackageFile } from '.';

const onlyWrapperProperties =
  'wrapperUrl=https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar';
const onlyMavenProperties =
  'distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.5.4/apache-maven-3.5.4-bin.zip';

const wrapperAndMavenProperties = `distributionUrl=https://internal.artifactory.acme.org/artifactory/maven-bol/org/apache/maven/apache-maven/3.8.4/apache-maven-3.8.4-bin.zip\nwrapperUrl=https://internal.artifactory.acme.org/artifactory/maven-bol/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar`;

describe('modules/manager/maven-wrapper/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts version for property file with distribution type "bin" in distributionUrl', () => {
      const res = extractPackageFile(wrapperAndMavenProperties);
      expect(res?.deps).toEqual([
        {
          currentValue: '3.8.4',
          replaceString:
            'https://internal.artifactory.acme.org/artifactory/maven-bol/org/apache/maven/apache-maven/3.8.4/apache-maven-3.8.4-bin.zip',
          datasource: 'maven',
          depName: 'maven',
          packageName: 'org.apache.maven:apache-maven',
          versioning: 'maven',
        },
        {
          currentValue: '3.1.0',
          replaceString:
            'https://internal.artifactory.acme.org/artifactory/maven-bol/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar',
          datasource: 'maven',
          depName: 'maven-wrapper',
          packageName: 'org.apache.maven.wrapper:maven-wrapper',
          versioning: 'maven',
        },
      ]);
    });

    // takari or maven wrapper ??
    it('extracts version for property file with only a wrapper url', () => {
      const res = extractPackageFile(onlyWrapperProperties);
      expect(res?.deps).toEqual([
        {
          currentValue: '0.5.6',
          replaceString:
            'https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar',
          datasource: 'maven',
          depName: 'maven-wrapper',
          packageName: 'org.apache.maven.wrapper:maven-wrapper',
          versioning: 'maven',
        },
      ]);
    });

    it('extracts version for property file with only a maven url', () => {
      const res = extractPackageFile(onlyMavenProperties);
      expect(res?.deps).toEqual([
        {
          currentValue: '3.5.4',
          replaceString:
            'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.5.4/apache-maven-3.5.4-bin.zip',
          datasource: 'maven',
          depName: 'maven',
          packageName: 'org.apache.maven:apache-maven',
          versioning: 'maven',
        },
      ]);
    });

    it('it should return null when there is no string matching the maven properties regex', () => {
      const res = extractPackageFile('nowrapper');
      expect(res).toBeNull();
    });
  });
});
