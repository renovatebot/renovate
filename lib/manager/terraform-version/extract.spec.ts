import { extractPackageFile } from './extract';

describe('manager/terraform-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('12.0.0\n');
      // FIXME: explicit assert condition
      expect(res.deps).toMatchSnapshot();
    });
    it('skips non ranges', () => {
      const res = extractPackageFile('latest');
      // FIXME: explicit assert condition
      expect(res.deps).toMatchSnapshot();
    });
  });
});
