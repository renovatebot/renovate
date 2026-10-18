import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

const typeBinFileContent = Fixtures.get('gradle-wrapper-bin.properties');
const typeAllFileContent = Fixtures.get('gradle-wrapper-all.properties');

describe('modules/manager/gradle-wrapper/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for property file without distributionUrl', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('returns null for property file with unsupported distributionUrl format', () => {
      const unknownFormatFileContent = codeBlock`
        distributionBase=GRADLE_USER_HOME
        distributionPath=wrapper/dists
        zipStoreBase=GRADLE_USER_HOME
        zipStorePath=wrapper/dists

        # distributionUrl includes unsupported file name format
        distributionUrl=https\\://services.gradle.org/distributions/gradle-7-rc-1-bin.zip
      `;
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
      const prereleaseVersionFileContent = codeBlock`
        distributionBase=GRADLE_USER_HOME
        distributionPath=wrapper/dists
        zipStoreBase=GRADLE_USER_HOME
        zipStorePath=wrapper/dists

        # distributionUrl includes prerelase version
        distributionUrl=https\\://services.gradle.org/distributions/gradle-7.0-milestone-1-bin.zip
      `;
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
      const whitespacePropertiesFile = codeBlock`
        distributionBase=GRADLE_USER_HOME
        distributionPath=wrapper/dists
        zipStoreBase=GRADLE_USER_HOME
        zipStorePath=wrapper/dists

        # distributionUrl and distributionSha256Sum include unnecessary whitespace
        distributionUrl    =      https\\://services.gradle.org/distributions/gradle-4.10.3-all.zip
        distributionSha256Sum       =    336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043
      `;
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
      const customTypeBinFileContent = codeBlock`
        distributionBase=GRADLE_USER_HOME
        distributionPath=wrapper/dists
        zipStoreBase=GRADLE_USER_HOME
        zipStorePath=wrapper/dists

        # distributionUrl includes version both in file name and path hierarchy, file name has different prefix
        distributionUrl=https\\://domain.tld/repository/maven-releases/tld/domain/gradle-wrapper/custom-gradle-wrapper/1.3.7/custom-gradle-wrapper-1.3.7-bin.zip
      `;
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
      const customTypeAllFileContent = codeBlock`
        distributionBase=GRADLE_USER_HOME
        distributionPath=wrapper/dists
        zipStoreBase=GRADLE_USER_HOME
        zipStorePath=wrapper/dists

        # distributionUrl includes version both in file name and path hierarchy, file name has different prefix
        distributionUrl=https\\://domain.tld/repository/maven-releases/tld/domain/gradle-wrapper/custom-gradle-wrapper/6.6.6/custom-gradle-wrapper-6.6.6-all.zip
      `;
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
