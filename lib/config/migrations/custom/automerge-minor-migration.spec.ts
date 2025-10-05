import { AutomergeMinorMigration } from './automerge-minor-migration';

describe('config/migrations/custom/automerge-minor-migration', () => {
  it('should migrate value to object', async () => {
    await expect(AutomergeMinorMigration).toMigrate(
      {
        automergeMinor: 'some-value',
      },
      {
        minor: {
          automerge: true,
        },
      },
    );
  });

  it('should migrate value to object and concat with existing minor object', async () => {
    await expect(AutomergeMinorMigration).toMigrate(
      {
        automergeMinor: 'some-value',
        minor: {
          matchFileNames: ['test'],
        },
      },
      {
        minor: {
          automerge: true,
          matchFileNames: ['test'],
        },
      },
    );
  });

  it('should ignore non object minor value', async () => {
    await expect(AutomergeMinorMigration).toMigrate(
      {
        automergeMinor: 'some-value',
        minor: null,
      },
      {
        minor: {
          automerge: true,
        },
      },
    );
  });
});
