import { loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const typeBinFileContent = loadFixture('gradle-wrapper-bin.properties');
const typeAllFileContent = loadFixture('gradle-wrapper-all.properties');
const prereleaseVersionFileContent = loadFixture(
  'gradle-wrapper-prerelease.properties'
);
const unknownFormatFileContent = loadFixture(
  'gradle-wrapper-unknown-format.properties'
);
const whitespacePropertiesFile = loadFixture(
  'gradle-wrapper-whitespace.properties'
);

describe('manager/gradle-wrapper/extract', () => {
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
      expect(res.deps).toEqual([
        {
          currentValue: '4.8',
          datasource: 'gradle-version',
          depName: 'gradle',
          versioning: 'gradle',
        },
      ]);
    });

    it('extracts version for property file with distribution type "all" in distributionUrl', () => {
      const res = extractPackageFile(typeAllFileContent);
      expect(res.deps).toEqual([
        {
          currentValue: '4.10.3',
          datasource: 'gradle-version',
          depName: 'gradle',
          versioning: 'gradle',
        },
      ]);
    });

    it('extracts version for property file with prerelease version in distributionUrl', () => {
      const res = extractPackageFile(prereleaseVersionFileContent);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps[0].currentValue).toBe('7.0-milestone-1');
    });

    it('extracts version for property file with unnecessary whitespace in distributionUrl', () => {
      const res = extractPackageFile(whitespacePropertiesFile);
      expect(res.deps).toEqual([
        {
          currentValue: '4.10.3',
          datasource: 'gradle-version',
          depName: 'gradle',
          versioning: 'gradle',
        },
      ]);
    });
  });
});
