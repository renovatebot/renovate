import { RenovateForkMigration } from './include-forks-migration';

describe('config/migrations/custom/include-forks-migration', () => {
  it('should migrate true', () => {
    expect(RenovateForkMigration).toMigrate(
      {
        includeForks: true,
      },
      {
        forkProcessing: 'enabled',
      }
    );
  });

  it('should migrate false', () => {
    expect(RenovateForkMigration).toMigrate(
      {
        includeForks: false,
      },
      {
        forkProcessing: 'disabled',
      }
    );
  });

  it('should not migrate non boolean value', () => {
    expect(RenovateForkMigration).toMigrate(
      {
        includeForks: 'test',
      },
      {}
    );
  });
});
