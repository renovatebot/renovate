import { RenovateForkMigration } from './renovate-fork-migration';

describe('config/migrations/custom/renovate-fork-migration', () => {
  it('should migrate true', () => {
    expect(RenovateForkMigration).toMigrate(
      {
        renovateFork: true,
      },
      {
        forkProcessing: 'enabled',
      },
    );
  });

  it('should migrate false', () => {
    expect(RenovateForkMigration).toMigrate(
      {
        renovateFork: false,
      },
      {
        forkProcessing: 'disabled',
      },
    );
  });

  it('should not migrate non boolean value', () => {
    expect(RenovateForkMigration).toMigrate(
      {
        renovateFork: 'test',
      },
      {},
    );
  });
});
