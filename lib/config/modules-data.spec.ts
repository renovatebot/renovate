import {
  getDatasourceDefaultConfig,
  getManagerCategories,
  getSupportedToolNames,
  getToolConfig,
  isConstraintName,
  isCustomManager,
  isToolName,
} from './modules-data.ts';

describe('config/modules-data', () => {
  describe('getSupportedToolNames()', () => {
    it('returns the tools with a config', () => {
      expect(getSupportedToolNames()).toContain('node');
      expect(getSupportedToolNames()).not.toContain('git');
    });
  });

  describe('getToolConfig()', () => {
    it('returns the config of a supported tool', () => {
      expect(getToolConfig('bun')).toEqual({
        datasource: 'github-releases',
        packageName: 'oven-sh/bun',
        extractVersion: '^bun-v(?<version>.*)$',
        versioning: 'npm',
      });
    });

    it('returns undefined for an unsupported tool', () => {
      expect(getToolConfig('git')).toBeUndefined();
    });
  });

  describe('isToolName()', () => {
    it.each`
      value              | expected
      ${'node'}          | ${true}
      ${'ghActionsLock'} | ${false}
      ${'unknown'}       | ${false}
      ${1}               | ${false}
      ${undefined}       | ${false}
    `('isToolName($value) === $expected', ({ value, expected }) => {
      expect(isToolName(value)).toBe(expected);
    });
  });

  describe('isConstraintName()', () => {
    it.each`
      value              | expected
      ${'node'}          | ${true}
      ${'ghActionsLock'} | ${true}
      ${'unknown'}       | ${false}
      ${1}               | ${false}
    `('isConstraintName($value) === $expected', ({ value, expected }) => {
      expect(isConstraintName(value)).toBe(expected);
    });
  });

  describe('isCustomManager()', () => {
    it.each`
      value        | expected
      ${'regex'}   | ${true}
      ${'npm'}     | ${false}
      ${'unknown'} | ${false}
    `('isCustomManager($value) === $expected', ({ value, expected }) => {
      expect(isCustomManager(value)).toBe(expected);
    });
  });

  describe('getManagerCategories()', () => {
    it('returns the categories of a manager', () => {
      expect(getManagerCategories('npm')).toEqual(['js']);
    });

    it('returns undefined for an unknown manager', () => {
      expect(getManagerCategories('unknown')).toBeUndefined();
    });
  });

  describe('getDatasourceDefaultConfig()', () => {
    it('returns the default config of a datasource', () => {
      expect(getDatasourceDefaultConfig('docker')).toEqual(expect.any(Object));
    });

    it('returns undefined for a datasource without default config', () => {
      expect(getDatasourceDefaultConfig('npm')).toBeUndefined();
    });

    it('returns undefined for an unknown datasource', () => {
      expect(getDatasourceDefaultConfig('unknown')).toBeUndefined();
    });
  });
});
