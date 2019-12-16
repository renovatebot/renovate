import { readFileSync } from 'fs';
import {
  extractPackageFile,
  TerraformDependencyTypes,
  getTerraformDependencyType,
} from '../../../lib/manager/terraform/extract';

const tf1 = readFileSync('test/datasource/terraform/_fixtures/1.tf', 'utf8');
const tf2 = `module "relative" {
  source = "../../modules/fe"
}
`;

describe('lib/manager/terraform/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts', () => {
      const res = extractPackageFile(tf1);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(19);
      expect(res.deps.filter(dep => dep.skipReason)).toHaveLength(7);
      expect(
        res.deps.filter(
          dep =>
            dep.managerData.terraformDependencyType ===
            TerraformDependencyTypes.module
        )
      ).toHaveLength(14);
      expect(
        res.deps.filter(
          dep =>
            dep.managerData.terraformDependencyType ===
            TerraformDependencyTypes.provider
        )
      ).toHaveLength(5);
    });
    it('returns null if only local deps', () => {
      expect(extractPackageFile(tf2)).toBeNull();
    });
  });
  describe('getTerraformDependencyType()', () => {
    it('returns TerraformDependencyTypes.module', () => {
      expect(getTerraformDependencyType('module')).toBe(
        TerraformDependencyTypes.module
      );
    });
    it('returns TerraformDependencyTypes.provider', () => {
      expect(getTerraformDependencyType('provider')).toBe(
        TerraformDependencyTypes.provider
      );
    });
    it('returns TerraformDependencyTypes.unknown', () => {
      expect(getTerraformDependencyType('unknown')).toBe(
        TerraformDependencyTypes.unknown
      );
    });
    it('returns TerraformDependencyTypes.unknown on empty string', () => {
      expect(getTerraformDependencyType('')).toBe(
        TerraformDependencyTypes.unknown
      );
    });
    it('returns TerraformDependencyTypes.unknown on string with random chars', () => {
      expect(getTerraformDependencyType('sdfsgdsfadfhfghfhgdfsdf')).toBe(
        TerraformDependencyTypes.unknown
      );
    });
  });
});
