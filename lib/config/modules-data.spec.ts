import {
  getAdditionalConstraints,
  getDatasourceDefaultConfig,
  getManagerCategories,
  getSupportedToolNames,
  getToolConfig,
  getToolDescription,
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

  describe('getToolDescription()', () => {
    it('returns the documentation of a tool', () => {
      expect(getToolDescription('ruby')).toBe(
        'Also used in the `rubygems` Datasource',
      );
    });

    it('returns undefined for a tool without documentation', () => {
      expect(getToolDescription('node')).toBeUndefined();
    });
  });

  describe('getAdditionalConstraints()', () => {
    it('returns the constraints which are not a tool', () => {
      expect(getAdditionalConstraints()).toContainEqual({
        name: 'ghActionsLock',
        description: expect.any(String),
      });
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
