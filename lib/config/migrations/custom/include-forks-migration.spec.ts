import { IncludeForksMigration } from './include-forks-migration';

describe('config/migrations/custom/include-forks-migration', () => {
  it('should migrate true', async () => {
    await expect(IncludeForksMigration).toMigrate(
      {
        includeForks: true,
      },
      {
        forkProcessing: 'enabled',
      },
    );
  });

  it('should migrate false', async () => {
    await expect(IncludeForksMigration).toMigrate(
      {
        includeForks: false,
      },
      {
        forkProcessing: 'disabled',
      },
    );
  });

  it('should not migrate non boolean value', async () => {
    await expect(IncludeForksMigration).toMigrate(
      {
        includeForks: 'test',
      },
      {},
    );
  });
});
