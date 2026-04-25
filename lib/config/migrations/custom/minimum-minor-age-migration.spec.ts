import { MinimumMinorAgeMigration } from './minimum-minor-age-migration.ts';

describe('config/migrations/custom/minimum-minor-age-migration', () => {
  it('migrates minimumMinorAge alone', async () => {
    await expect(MinimumMinorAgeMigration).toMigrate(
      {
        minimumMinorAge: '7 days',
      },
      {
        minimumReleaseAge: {
          delayMinor: '7 days',
        },
      },
    );
  });

  it('migrates minimumMinorAge with existing string minimumReleaseAge', async () => {
    await expect(MinimumMinorAgeMigration).toMigrate(
      {
        minimumReleaseAge: '3 days',
        minimumMinorAge: '7 days',
      },
      {
        minimumReleaseAge: {
          default: '3 days',
          delayMinor: '7 days',
        },
      },
    );
  });

  it('migrates minimumMinorAge with existing object minimumReleaseAge', async () => {
    await expect(MinimumMinorAgeMigration).toMigrate(
      {
        minimumReleaseAge: {
          default: '3 days',
          delayMajor: '14 days',
        },
        minimumMinorAge: '7 days',
      },
      {
        minimumReleaseAge: {
          default: '3 days',
          delayMajor: '14 days',
          delayMinor: '7 days',
        },
      },
    );
  });

  it('does not migrate non-string values', async () => {
    await expect(MinimumMinorAgeMigration).toMigrate(
      {
        minimumMinorAge: 123 as any,
      },
      {},
    );
    // minimumReleaseAge should not be set for non-string minimumMinorAge
    const { MigrationsService } = await import('../migrations-service.ts');
    const migrated = MigrationsService.run({
      minimumMinorAge: 123,
    } as any);
    expect(migrated).not.toHaveProperty('minimumMinorAge');
    expect(migrated).not.toHaveProperty('minimumReleaseAge');
  });
});
