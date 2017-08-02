const configMigration = require('../../lib/config/migration.js');

describe('config/migration', () => {
  describe('migrateConfig(config)', () => {
    it('it migrates config', () => {
      const config = {
        enabled: true,
        maintainYarnLock: true,
      };
      const { isMigrated, migratedConfig } = configMigration.migrateConfig(
        config
      );
      expect(isMigrated).toBe(true);
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
