import { ScheduleMigration } from './schedule-migration.ts';

describe('config/migrations/custom/schedule-migration', () => {
  it('migrates every friday', async () => {
    await expect(ScheduleMigration).toMigrate(
      {
        schedule: 'every friday',
      },
      {
        schedule: 'on friday',
      },
    );
  });

  it('does not migrate every weekday', async () => {
    await expect(ScheduleMigration).toMigrate(
      {
        schedule: 'every weekday',
      },
      {
        schedule: 'every weekday',
      },
      false,
    );
  });

  it('does not migrate multi days', async () => {
    await expect(ScheduleMigration).toMigrate(
      {
        schedule: 'after 5:00pm on wednesday and thursday',
      },
      {
        schedule: 'after 5:00pm on wednesday and thursday',
      },
      false,
    );
  });

  it('does not migrate hour range', async () => {
    await expect(ScheduleMigration).toMigrate(
      {
        schedule: 'after 1:00pm and before 5:00pm',
      },
      {
        schedule: 'after 1:00pm and before 5:00pm',
      },
      false,
    );
  });

  it('does not migrate invalid range', async () => {
    await expect(ScheduleMigration).toMigrate(
      {
        schedule: 'after and before 5:00',
      },
      {
        schedule: 'after and before 5:00',
      },
      false,
    );
  });
});
