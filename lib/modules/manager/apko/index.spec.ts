import {
  defaultConfig,
  supportedDatasources,
  supportsLockFileMaintenance,
} from '.';

describe('modules/manager/apko/index', () => {
  describe('defaultConfig', () => {
    it('should have correct managerFilePatterns', () => {
      expect(defaultConfig.managerFilePatterns).toEqual([
        '/(^|/)apko\\.ya?ml$/',
      ]);
    });

    it('should match apko.yaml files', () => {
      const pattern = defaultConfig.managerFilePatterns[0];
      // Remove the leading and trailing slashes for RegExp constructor
      const regex = new RegExp(pattern.slice(1, -1));
      expect(regex.test('apko.yaml')).toBe(true);
      expect(regex.test('apko.yml')).toBe(true);
      expect(regex.test('config/apko.yaml')).toBe(true);
      expect(regex.test('config/apko.yml')).toBe(true);
      expect(regex.test('apko.txt')).toBe(false);
      expect(regex.test('Dockerfile')).toBe(false);
    });
  });

  describe('supportedDatasources', () => {
    it('should include docker datasource', () => {
      expect(supportedDatasources).toEqual(['apk']);
    });
  });

  describe('supportsLockFileMaintenance', () => {
    it('should be true', () => {
      expect(supportsLockFileMaintenance).toBe(true);
    });
  });
});
