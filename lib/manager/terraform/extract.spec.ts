import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

const tf1 = readFileSync('lib/manager/terraform/__fixtures__/1.tf', 'utf8');
const tf2 = `module "relative" {
  source = "../../modules/fe"
}
`;
const helm = readFileSync('lib/manager/terraform/__fixtures__/helm.tf', 'utf8');

describe('lib/manager/terraform/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts', () => {
      const res = extractPackageFile(tf1);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(41);
      expect(res.deps.filter((dep) => dep.skipReason)).toHaveLength(12);
    });
    it('returns null if only local deps', () => {
      expect(extractPackageFile(tf2)).toBeNull();
    });
    it('extract helm releases', () => {
      const res = extractPackageFile(helm);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
      expect(res.deps.filter((dep) => dep.skipReason)).toHaveLength(3);
    });
  });
});
