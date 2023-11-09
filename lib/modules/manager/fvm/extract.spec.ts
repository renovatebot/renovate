import { extractPackageFile } from '.';

const packageFile = 'packageFile';

describe('modules/manager/fvm/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid json', () => {
      expect(
        extractPackageFile('clearly invalid json', packageFile),
      ).toBeNull();
    });

    it('returns null for empty flutter sdk version', () => {
      expect(extractPackageFile('{}', packageFile)).toBeNull();
    });

    it('returns null for non string flutter sdk version', () => {
      expect(
        extractPackageFile(
          '{"flutterSdkVersion": 2.1, "flavors": {}}',
          packageFile,
        ),
      ).toBeNull();
    });

    it('returns a result', () => {
      const res = extractPackageFile(
        '{"flutterSdkVersion": "2.10.1", "flavors": {}}',
        packageFile,
      );
      expect(res?.deps).toEqual([
        {
          currentValue: '2.10.1',
          datasource: 'flutter-version',
          depName: 'flutter',
          packageName: 'flutter/flutter',
        },
      ]);
    });

    it('supports non range', () => {
      const res = extractPackageFile(
        '{"flutterSdkVersion": "stable", "flavors": {}}',
        packageFile,
      );
      expect(res?.deps).toEqual([
        {
          currentValue: 'stable',
          datasource: 'flutter-version',
          depName: 'flutter',
          packageName: 'flutter/flutter',
        },
      ]);
    });
  });
});
