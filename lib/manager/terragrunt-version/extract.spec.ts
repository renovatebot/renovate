import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

describe(getName(__filename), () => {
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
