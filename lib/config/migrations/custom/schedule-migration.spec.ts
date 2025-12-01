import { ScheduleMigration } from './schedule-migration';

describe('config/migrations/custom/schedule-migration', () => {
  it('migrates every friday', async () => {
    await expect(ScheduleMigration).toMigrate(
      {
        schedule: 'every friday',
      } as any,
      {
        schedule: 'on friday',
      } as any,
    );
  });

  it('does not migrate every weekday', async () => {
    await expect(ScheduleMigration).toMigrate(
      {
        schedule: 'every weekday',
      } as any,
      {
        schedule: 'every weekday',
      } as any,
      false,
    );
  });

  it('does not migrate multi days', async () => {
    await expect(ScheduleMigration).toMigrate(
      {
        schedule: 'after 5:00pm on wednesday and thursday',
      } as any,
      {
        schedule: 'after 5:00pm on wednesday and thursday',
      } as any,
      false,
    );
  });

  it('does not migrate hour range', async () => {
    await expect(ScheduleMigration).toMigrate(
      {
        schedule: 'after 1:00pm and before 5:00pm',
      } as any,
      {
        schedule: 'after 1:00pm and before 5:00pm',
      } as any,
      false,
    );
  });

  it('does not migrate invalid range', async () => {
    await expect(ScheduleMigration).toMigrate(
      {
        schedule: 'after and before 5:00',
      } as any,
      {
        schedule: 'after and before 5:00',
      } as any,
      false,
    );
  });
});
