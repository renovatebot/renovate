import { extractPackageFile } from './extract';

describe('lib/manager/terragrunt-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('12.0.0\n');
      expect(res.deps).toMatchSnapshot();
    });
    it('skips non ranges', () => {
      const res = extractPackageFile('latest');
      expect(res.deps).toMatchSnapshot();
    });
  });
});
