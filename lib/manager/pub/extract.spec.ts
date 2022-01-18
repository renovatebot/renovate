import { loadFixture } from '../../../test/util';
import { extractPackageFile } from '.';

const brokenYaml = loadFixture('update.yaml');
const packageFile = loadFixture('extract.yaml');

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
      expect(res).toEqual({
        datasource: 'dart',
        deps: [
          { currentValue: '1', depName: 'foo', depType: 'dependencies' },
          { currentValue: '1', depName: 'bar', depType: 'dependencies' },
          { currentValue: null, depName: 'baz', depType: 'dependencies' },
          { currentValue: null, depName: 'qux', depType: 'dependencies' },
          {
            currentValue: '^0.1',
            depName: 'test',
            depType: 'dev_dependencies',
          },
          {
            currentValue: '0.1',
            depName: 'build',
            depType: 'dev_dependencies',
          },
        ],
        packageFile: 'pubspec.yaml',
      });
    });
  });
});
