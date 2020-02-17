import { extractPackageFile } from './extract';

describe('lib/manager/ruby-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile({ fileContent: '8.4.0\n' });
      expect(res.deps).toMatchSnapshot();
    });
    it('supports ranges', () => {
      const res = extractPackageFile({ fileContent: '8.4\n' });
      expect(res.deps).toMatchSnapshot();
    });
    it('skips non ranges', () => {
      const res = extractPackageFile({ fileContent: 'latestn' });
      expect(res.deps).toMatchSnapshot();
    });
  });
});
