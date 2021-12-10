import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from '.';

const brokenYaml = Fixtures.get('update.yaml');
const packageFile = Fixtures.get('extract.yaml');

describe('manager/pub/extract', () => {
  describe('extractPackageFile', () => {
    it('should return null if package does not contain any deps', () => {
      const res = extractPackageFile('foo: bar', 'pubspec.yaml');
      expect(res).toBeNull();
    });
    it('should return null if package is invalid', () => {
      const res = extractPackageFile(brokenYaml, 'pubspec.yaml');
      expect(res).toBeNull();
    });
    it('should return valid dependencies', () => {
      const res = extractPackageFile(packageFile, 'pubspec.yaml');
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
  });
});
