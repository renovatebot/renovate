import { AutomergeMinorMigration } from './automerge-minor-migration';

describe('config/migrations/custom/automerge-minor-migration', () => {
  it('should migrate value to object', () => {
    expect(AutomergeMinorMigration).toMigrate(
      {
        automergeMinor: 'some-value',
      },
      {
        minor: {
          automerge: true,
        },
      }
    );
  });

  it('should migrate value to object and concat with existing minor object', () => {
    expect(AutomergeMinorMigration).toMigrate(
      {
        automergeMinor: 'some-value',
        minor: {
          matchFiles: ['test'],
        },
      },
      {
        minor: {
          automerge: true,
          matchFiles: ['test'],
        },
      }
    );
  });

  it('should ignore non object minor value', () => {
    expect(AutomergeMinorMigration).toMigrate(
      {
        automergeMinor: 'some-value',
        minor: null,
      },
      {
        minor: {
          automerge: true,
        },
      }
    );
  });
});
