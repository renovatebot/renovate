import { loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const packageFile = 'packageFile';

const fvmConfigRange = loadFixture('fvm-config-range.json');
const fvmConfigNonRange = loadFixture('fvm-config-non-range.json');
const fvmConfigNonString = loadFixture('fvm-config-non-string.json');

describe('manager/fvm/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid json', () => {
      expect(
        extractPackageFile('clearly invalid json', packageFile)
      ).toBeNull();
    });
    it('returns null for empty flutter sdk version', () => {
      expect(extractPackageFile('{}', packageFile)).toBeNull();
    });
    it('returns null for non string flutter sdk version', () => {
      expect(extractPackageFile(fvmConfigNonString, packageFile)).toBeNull();
    });
    it('returns a result', () => {
      const res = extractPackageFile(fvmConfigRange, packageFile);
      expect(res.deps).toEqual([
        {
          currentValue: '2.10.1',
          datasource: 'github-tags',
          depName: 'flutter',
          lookupName: 'flutter/flutter',
        },
      ]);
    });
    it('supports non range', () => {
      const res = extractPackageFile(fvmConfigNonRange, packageFile);
      expect(res.deps).toEqual([
        {
          currentValue: 'stable',
          datasource: 'github-tags',
          depName: 'flutter',
          lookupName: 'flutter/flutter',
        },
      ]);
    });
  });
});
