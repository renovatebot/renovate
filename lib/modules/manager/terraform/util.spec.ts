import { getTerraformDependencyType } from './util';

describe('modules/manager/terraform/util', () => {
  describe('getTerraformDependencyType()', () => {
    it('returns module', () => {
      expect(getTerraformDependencyType('module')).toBe('module');
    });

    it('returns provider', () => {
      expect(getTerraformDependencyType('provider')).toBe('provider');
    });

    it('returns unknown', () => {
      expect(getTerraformDependencyType('unknown')).toBe('unknown');
    });

    it('returns required_providers', () => {
      expect(getTerraformDependencyType('required_providers')).toBe(
        'required_providers'
      );
    });

    it('returns unknown on empty string', () => {
      expect(getTerraformDependencyType('')).toBe('unknown');
    });

    it('returns unknown on string with random chars', () => {
      expect(getTerraformDependencyType('sdfsgdsfadfhfghfhgdfsdf')).toBe(
        'unknown'
      );
    });
  });
});
