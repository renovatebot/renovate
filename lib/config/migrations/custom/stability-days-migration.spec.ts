import { StabilityDaysMigration } from './stability-days-migration';

describe('config/migrations/custom/stability-days-migration', () => {
  it('migrates', () => {
    expect(StabilityDaysMigration).toMigrate(
      {
        stabilityDays: 0,
      },
      {
        minimumReleaseAge: null,
      },
    );
    expect(StabilityDaysMigration).toMigrate(
      {
        stabilityDays: 2,
      },
      {
        minimumReleaseAge: '2 days',
      },
    );
    expect(StabilityDaysMigration).toMigrate(
      {
        stabilityDays: 1,
      },
      {
        minimumReleaseAge: '1 day',
      },
    );
  });
});
