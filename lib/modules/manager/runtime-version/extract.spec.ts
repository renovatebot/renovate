import { extractPackageFile } from '.';

describe('modules/manager/runtime-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result - python', () => {
      const res = extractPackageFile('python-3.12.4');
      expect(res?.deps).toEqual([
        {
          depName: 'python',
          currentValue: '3.12.4',
          datasource: 'docker',
        },
      ]);
    });

    it('returns no result', () => {
      const res = extractPackageFile('3.12.4');
      expect(res).toBeNull();
    });
  });
});
