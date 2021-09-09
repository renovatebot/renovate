import { extractPackageFile } from './extract';

describe('manager/pyenv/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('3.7.1\n');
      // FIXME: explicit assert condition
      expect(res.deps).toMatchSnapshot();
    });
    it('supports ranges', () => {
      const res = extractPackageFile('3.8\n');
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
