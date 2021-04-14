import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('8.4.0\n');
      expect(res.deps).toMatchSnapshot();
    });
    it('supports ranges', () => {
      const res = extractPackageFile('8.4\n');
      expect(res.deps).toMatchSnapshot();
    });
    it('skips non ranges', () => {
      const res = extractPackageFile('latestn');
      expect(res.deps).toMatchSnapshot();
    });
  });
});
