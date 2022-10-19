import { extractPackageFile } from '.';

describe('modules/manager/terraform-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('12.0.0\n');
      expect(res).toEqual({
        deps: [
          {
            depName: 'hashicorp/terraform',
            currentValue: '12.0.0',
            datasource: 'github-releases',
          },
        ],
      });
    });

    it('skips non ranges', () => {
      const res = extractPackageFile('latest');
      expect(res).toEqual({
        deps: [
          {
            depName: 'hashicorp/terraform',
            currentValue: 'latest',
            datasource: 'github-releases',
          },
        ],
      });
    });
  });
});
