import { AutomergeMajorMigration } from './automerge-major-migration';

describe('config/migrations/custom/automerge-major-migration', () => {
  it('should migrate value to object', async () => {
    await expect(AutomergeMajorMigration).toMigrate(
      {
        automergeMajor: 'some-value',
      },
      {
        major: {
          automerge: true,
        },
      },
    );
  });

  it('should migrate value to object and concat with existing minor object', async () => {
    await expect(AutomergeMajorMigration).toMigrate(
      {
        automergeMajor: 'some-value',
        major: {
          matchFileNames: ['test'],
        },
      },
      {
        major: {
          automerge: true,
          matchFileNames: ['test'],
        },
      },
    );
  });

  it('should ignore non object minor value', async () => {
    await expect(AutomergeMajorMigration).toMigrate(
      {
        automergeMajor: 'some-value',
        major: null,
      },
      {
        major: {
          automerge: true,
        },
      },
    );
  });
});
