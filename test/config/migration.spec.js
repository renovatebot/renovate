const configMigration = require('../../lib/config/migration.js');

describe('config/migration', () => {
  describe('migrateConfig(config)', () => {
    it('it migrates config', () => {
      const config = {
        enabled: true,
        maintainYarnLock: true,
        depTypes: [
          'dependencies',
          {
            depType: 'optionalDependencies',
            respectLatest: false,
          },
        ],
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config
      );
      expect(isMigrated).toBe(true);
      expect(migratedConfig.depTypes).not.toBeDefined();
      expect(migratedConfig.optionalDependencies.respectLatest).toBe(false);
      expect(migratedConfig).toMatchSnapshot();
    });
    it('it does not migrate config', () => {
      const config = {
        enabled: true,
        separatePatchReleases: true,
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config
      );
      expect(isMigrated).toBe(false);
      expect(migratedConfig).toMatchObject(config);
    });
  });
});
