import { VersionStrategyMigration } from './version-strategy-migration';

describe('config/migrations/custom/version-strategy-migration', () => {
  it('should migrate versionStrategy="widen" to rangeStrategy="widen"', async () => {
    await expect(VersionStrategyMigration).toMigrate(
      {
        versionStrategy: 'widen',
      },
      {
        rangeStrategy: 'widen',
      },
    );
  });

  it('should just remove property when versionStrategy not equals to "widen"', async () => {
    await expect(VersionStrategyMigration).toMigrate(
      {
        versionStrategy: 'test',
      },
      {},
    );
  });
});
