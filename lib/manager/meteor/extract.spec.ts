import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const input01Content = loadFixture(__filename, 'package-1.js');

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n');
      expect(res).toBeNull();
    });
    it('returns results', () => {
      const res = extractPackageFile(input01Content);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });
  });
});
