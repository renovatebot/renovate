import { UpgradeInRangeMigration } from './upgrade-in-range-migration';

describe('config/migrations/custom/upgrade-in-range-migration', () => {
  it('should migrate upgradeInRange=true to rangeStrategy="bump"', () => {
    expect(UpgradeInRangeMigration).toMigrate(
      {
        upgradeInRange: true,
      },
      {
        rangeStrategy: 'bump',
      },
    );
  });

  it('should just remove property when upgradeInRange not equals to true', () => {
    expect(UpgradeInRangeMigration).toMigrate(
      {
        upgradeInRange: false,
      },
      {},
    );
  });
});
