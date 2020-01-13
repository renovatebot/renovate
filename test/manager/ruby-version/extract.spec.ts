import { extractPackageFile } from '../../../lib/manager/ruby-version/extract';

describe('lib/manager/ruby-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile({ content: '8.4.0\n' });
      expect(res.deps).toMatchSnapshot();
    });
    it('supports ranges', () => {
      const res = extractPackageFile({ content: '8.4\n' });
      expect(res.deps).toMatchSnapshot();
    });
    it('skips non ranges', () => {
      const res = extractPackageFile({ content: 'latestn' });
      expect(res.deps).toMatchSnapshot();
    });
  });
});
