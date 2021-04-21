import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import { extractPackageFile } from '.';

const brokenYaml = readFileSync(
  'lib/manager/pub/__fixtures__/update.yaml',
  'utf8'
);

const packageFile = readFileSync(
  'lib/manager/pub/__fixtures__/extract.yaml',
  'utf8'
);

describe(getName(__filename), () => {
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
      expect(res).toMatchSnapshot();
    });
  });
});
