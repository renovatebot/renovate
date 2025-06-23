import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const typeBinFileContent = Fixtures.get('gradle-wrapper-bin.properties');
const typeAllFileContent = Fixtures.get('gradle-wrapper-all.properties');
const prereleaseVersionFileContent = Fixtures.get(
  'gradle-wrapper-prerelease.properties',
);
const unknownFormatFileContent = Fixtures.get(
  'gradle-wrapper-unknown-format.properties',
);
const whitespacePropertiesFile = Fixtures.get(
  'gradle-wrapper-whitespace.properties',
);
const customTypeBinFileContent = Fixtures.get(
  'custom-gradle-wrapper-bin.properties',
);
const customTypeAllFileContent = Fixtures.get(
  'custom-gradle-wrapper-all.properties',
);

describe('modules/manager/gradle-wrapper/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for property file without distributionUrl', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('returns null for property file with unsupported distributionUrl format', () => {
      const res = extractPackageFile(unknownFormatFileContent);
      expect(res).toBeNull();
    });

    it('extracts version for property file with distribution type "bin" in distributionUrl', () => {
      const res = extractPackageFile(typeBinFileContent);
      expect(res?.deps).toEqual([
        {
          currentValue: '4.8',
          replaceString:
            'https\\://services.gradle.org/distributions/gradle-4.8-bin.zip',
          datasource: 'gradle-version',
          depName: 'gradle',
          versioning: 'gradle',
        },
      ]);
    });

    it('extracts version for property file with distribution type "all" in distributionUrl', () => {
      const res = extractPackageFile(typeAllFileContent);
      expect(res?.deps).toEqual([
        {
          currentValue: '4.10.3',
          replaceString:
            'https\\://services.gradle.org/distributions/gradle-4.10.3-all.zip',
          datasource: 'gradle-version',
          depName: 'gradle',
          versioning: 'gradle',
        },
      ]);
    });

    it('extracts version for property file with prerelease version in distributionUrl', () => {
      const res = extractPackageFile(prereleaseVersionFileContent);
      expect(res?.deps).toEqual([
        {
          currentValue: '7.0-milestone-1',
          replaceString:
            'https\\://services.gradle.org/distributions/gradle-7.0-milestone-1-bin.zip',
          datasource: 'gradle-version',
          depName: 'gradle',
          versioning: 'gradle',
        },
      ]);
    });

    it('extracts version for property file with unnecessary whitespace in distributionUrl', () => {
      const res = extractPackageFile(whitespacePropertiesFile);
      expect(res?.deps).toEqual([
        {
          currentValue: '4.10.3',
          replaceString:
            'https\\://services.gradle.org/distributions/gradle-4.10.3-all.zip',
          datasource: 'gradle-version',
          depName: 'gradle',
          versioning: 'gradle',
        },
      ]);
    });

    it('extracts version for property file with custom distribution of type "bin" in distributionUrl', () => {
      const res = extractPackageFile(customTypeBinFileContent);
      expect(res?.deps).toEqual([
        {
          currentValue: '1.3.7',
          replaceString:
            'https\\://domain.tld/repository/maven-releases/tld/domain/gradle-wrapper/custom-gradle-wrapper/1.3.7/custom-gradle-wrapper-1.3.7-bin.zip',
          datasource: 'gradle-version',
          depName: 'gradle',
          versioning: 'gradle',
        },
      ]);
    });

    it('extracts version for property file with custom distribution of type "all" in distributionUrl', () => {
      const res = extractPackageFile(customTypeAllFileContent);
      expect(res?.deps).toEqual([
        {
          currentValue: '6.6.6',
          replaceString:
            'https\\://domain.tld/repository/maven-releases/tld/domain/gradle-wrapper/custom-gradle-wrapper/6.6.6/custom-gradle-wrapper-6.6.6-all.zip',
          datasource: 'gradle-version',
          depName: 'gradle',
          versioning: 'gradle',
        },
      ]);
    });
  });
});
