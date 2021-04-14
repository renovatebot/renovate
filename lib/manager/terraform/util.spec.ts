import { getName } from '../../../test/util';
import { TerraformDependencyTypes, getTerraformDependencyType } from './util';

describe(getName(__filename), () => {
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
    it('returns TerraformDependencyTypes.required_providers', () => {
      expect(getTerraformDependencyType('required_providers')).toBe(
        TerraformDependencyTypes.required_providers
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
