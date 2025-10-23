import { StabilityDaysMigration } from './stability-days-migration';

describe('config/migrations/custom/stability-days-migration', () => {
  it('migrates', async () => {
    await expect(StabilityDaysMigration).toMigrate(
      {
        stabilityDays: 0,
      },
      {
        minimumReleaseAge: null,
      },
    );
    await expect(StabilityDaysMigration).toMigrate(
      {
        stabilityDays: 2,
      },
      {
        minimumReleaseAge: '2 days',
      },
    );
    await expect(StabilityDaysMigration).toMigrate(
      {
        stabilityDays: 1,
      },
      {
        minimumReleaseAge: '1 day',
      },
    );
  });
});
