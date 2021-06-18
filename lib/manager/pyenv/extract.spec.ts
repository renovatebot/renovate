import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('3.7.1\n');
      expect(res.deps).toMatchSnapshot();
    });
    it('supports ranges', () => {
      const res = extractPackageFile('3.8\n');
      expect(res.deps).toMatchSnapshot();
    });
    it('skips non ranges', () => {
      const res = extractPackageFile('latestn');
      expect(res.deps).toMatchSnapshot();
    });
  });
});
