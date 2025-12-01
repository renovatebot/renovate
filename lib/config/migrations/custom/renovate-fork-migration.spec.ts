import { RenovateForkMigration } from './renovate-fork-migration';

describe('config/migrations/custom/renovate-fork-migration', () => {
  it('should migrate true', async () => {
    await expect(RenovateForkMigration).toMigrate(
      {
        renovateFork: true,
      },
      {
        forkProcessing: 'enabled',
      },
    );
  });

  it('should migrate false', async () => {
    await expect(RenovateForkMigration).toMigrate(
      {
        renovateFork: false,
      },
      {
        forkProcessing: 'disabled',
      },
    );
  });

  it('should not migrate non boolean value', async () => {
    await expect(RenovateForkMigration).toMigrate(
      {
        renovateFork: 'test',
      },
      {},
    );
  });
});
