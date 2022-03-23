import { RenovateForkMigration } from './renovate-fork-migration';

describe('config/migrations/custom/renovate-fork-migration', () => {
  it('should migrate true', () => {
    expect(RenovateForkMigration).toMigrate(
      {
        renovateFork: true,
      },
      {
        includeForks: true,
      }
    );
  });

  it('should migrate false', () => {
    expect(RenovateForkMigration).toMigrate(
      {
        renovateFork: false,
      },
      {
        includeForks: false,
      }
    );
  });

  it('should not migrate non boolean value', () => {
    expect(RenovateForkMigration).toMigrate(
      {
        renovateFork: 'test',
      },
      {}
    );
  });
});
