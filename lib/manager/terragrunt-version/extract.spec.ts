import { extractPackageFile } from './extract';

describe('manager/terragrunt-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('12.0.0\n');
      // FIXME: explicit assert condition
      expect(res.deps).toMatchSnapshot();
    });
  });
});
