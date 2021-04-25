import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const tf1 = loadFixture(__filename, '1.tf');
const tf2 = `module "relative" {
  source = "../../modules/fe"
}
`;
const helm = loadFixture(__filename, 'helm.tf');

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts', () => {
      const res = extractPackageFile(tf1);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(46);
      expect(res.deps.filter((dep) => dep.skipReason)).toHaveLength(8);
    });
    it('returns null if only local deps', () => {
      expect(extractPackageFile(tf2)).toBeNull();
    });
    it('extract helm releases', () => {
      const res = extractPackageFile(helm);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
      expect(res.deps.filter((dep) => dep.skipReason)).toHaveLength(2);
    });
  });
});
