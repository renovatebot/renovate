import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const propertiesFile1 = loadFixture(__filename, 'gradle-wrapper-1.properties');
const propertiesFile2 = loadFixture(__filename, 'gradle-wrapper-2.properties');
const propertiesFile3 = loadFixture(__filename, 'gradle-wrapper-3.properties');
const propertiesFile4 = loadFixture(__filename, 'gradle-wrapper-4.properties');
const whitespacePropertiesFile = loadFixture(
  __filename,
  'gradle-wrapper-whitespace.properties'
);

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts bin version line', () => {
      const res = extractPackageFile(propertiesFile1);
      expect(res.deps).toMatchSnapshot();
    });

    it('extracts all version line', () => {
      const res = extractPackageFile(propertiesFile2);
      expect(res.deps).toMatchSnapshot();
    });

    it('extracts prerelease version line', () => {
      const res = extractPackageFile(propertiesFile3);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps[0].currentValue).toBe('7.0-milestone-1');
    });

    it('ignores invalid', () => {
      const res = extractPackageFile(propertiesFile4);
      expect(res).toBeNull();
    });

    it('handles whitespace', () => {
      const res = extractPackageFile(whitespacePropertiesFile);
      expect(res.deps).toMatchSnapshot();
    });
  });
});
