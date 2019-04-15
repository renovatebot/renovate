const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/pub');

const brokenYaml = fs.readFileSync(
  'test/manager/pub/_fixtures/update.yaml',
  'utf8'
);

const packageFile = fs.readFileSync(
  'test/manager/pub/_fixtures/extract.yaml',
  'utf8'
);

describe('manager/pub', () => {
  describe('extractPackageFile', () => {
    it('should return null if package does not contain any deps', () => {
      const res = extractPackageFile('foo: bar', 'pubspec.yaml');
      expect(res).toEqual(null);
    });
    it('should return null if package is invalid', () => {
      const res = extractPackageFile(brokenYaml, 'pubspec.yaml');
      expect(res).toEqual(null);
    });
    it('should return valid dependencies', () => {
      const res = extractPackageFile(packageFile, 'pubspec.yaml');
      expect(res).toMatchSnapshot();
    });
  });
});
