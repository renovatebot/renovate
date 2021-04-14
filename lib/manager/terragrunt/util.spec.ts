import { getName } from '../../../test/util';
import { TerragruntDependencyTypes, getTerragruntDependencyType } from './util';

describe(getName(__filename), () => {
  describe('getTerragruntDependencyType()', () => {
    it('returns TerragruntDependencyTypes.terragrunt', () => {
      expect(getTerragruntDependencyType('terraform')).toBe(
        TerragruntDependencyTypes.terragrunt
      );
    });
    it('returns TerragruntDependencyTypes.unknown', () => {
      expect(getTerragruntDependencyType('unknown')).toBe(
        TerragruntDependencyTypes.unknown
      );
    });
    it('returns TerragruntDependencyTypes.unknown on empty string', () => {
      expect(getTerragruntDependencyType('')).toBe(
        TerragruntDependencyTypes.unknown
      );
    });
    it('returns TerragruntDependencyTypes.unknown on string with random chars', () => {
      expect(getTerragruntDependencyType('sdfsgdsfadfhfghfhgdfsdf')).toBe(
        TerragruntDependencyTypes.unknown
      );
    });
  });
});
