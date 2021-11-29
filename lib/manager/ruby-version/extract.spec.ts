import { extractPackageFile } from './extract';

describe('manager/ruby-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('8.4.0\n');
      // FIXME: explicit assert condition
      expect(res.deps).toMatchSnapshot();
    });
    it('supports ranges', () => {
      const res = extractPackageFile('8.4\n');
      // FIXME: explicit assert condition
      expect(res.deps).toMatchSnapshot();
    });
    it('skips non ranges', () => {
      const res = extractPackageFile('latestn');
      // FIXME: explicit assert condition
      expect(res.deps).toMatchSnapshot();
    });
  });
});
