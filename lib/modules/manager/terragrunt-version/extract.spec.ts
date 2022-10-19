import { extractPackageFile } from '.';

describe('modules/manager/terragrunt-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('12.0.0\n');
      expect(res.deps).toEqual([
        {
          depName: 'gruntwork-io/terragrunt',
          currentValue: '12.0.0',
          datasource: 'github-releases',
        },
      ]);
    });
  });
});
