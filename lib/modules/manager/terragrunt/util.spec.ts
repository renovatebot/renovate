import { getTerragruntDependencyType } from './util';

describe('modules/manager/terragrunt/util', () => {
  describe('getTerragruntDependencyType()', () => {
    it('returns terraform', () => {
      expect(getTerragruntDependencyType('terraform')).toBe('terraform');
    });

    it('returns unknown', () => {
      expect(getTerragruntDependencyType('unknown')).toBe('unknown');
    });

    it('returns unknown on empty string', () => {
      expect(getTerragruntDependencyType('')).toBe('unknown');
    });

    it('returns unknown on string with random chars', () => {
      expect(getTerragruntDependencyType('sdfsgdsfadfhfghfhgdfsdf')).toBe(
        'unknown',
      );
    });
  });
});
