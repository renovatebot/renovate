import { IncludeForksMigration } from './include-forks-migration';

describe('config/migrations/custom/include-forks-migration', () => {
  it('should migrate true', () => {
    expect(IncludeForksMigration).toMigrate(
      {
        includeForks: true,
      },
      {
        forkProcessing: 'enabled',
      },
    );
  });

  it('should migrate false', () => {
    expect(IncludeForksMigration).toMigrate(
      {
        includeForks: false,
      },
      {
        forkProcessing: 'disabled',
      },
    );
  });

  it('should not migrate non boolean value', () => {
    expect(IncludeForksMigration).toMigrate(
      {
        includeForks: 'test',
      },
      {},
    );
  });
});
