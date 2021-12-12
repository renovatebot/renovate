import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from '.';

describe('manager/pub/extract', () => {
  describe('extractPackageFile', () => {
    it('should return null if package does not contain any deps', () => {
      const res = extractPackageFile('foo: bar', 'pubspec.yaml');
      expect(res).toBeNull();
    });
    it('should return null if package is invalid', () => {
      const res = extractPackageFile(
        Fixtures.get('update.yaml'),
        'pubspec.yaml'
      );
      expect(res).toBeNull();
    });
    it('should return valid dependencies', () => {
      const res = extractPackageFile(
        Fixtures.get('extract.yaml'),
        'pubspec.yaml'
      );
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
  });
});
