import { AutomergePatchMigration } from './automerge-patch-migration';

describe('config/migrations/custom/automerge-patch-migration', () => {
  it('should migrate value to object', async () => {
    await expect(AutomergePatchMigration).toMigrate(
      {
        automergePatch: 'some-value',
      },
      {
        patch: {
          automerge: true,
        },
      },
    );
  });

  it('should migrate value to object and concat with existing minor object', async () => {
    await expect(AutomergePatchMigration).toMigrate(
      {
        automergePatch: 'some-value',
        patch: {
          matchFileNames: ['test'],
        },
      },
      {
        patch: {
          automerge: true,
          matchFileNames: ['test'],
        },
      },
    );
  });

  it('should ignore non object minor value', async () => {
    await expect(AutomergePatchMigration).toMigrate(
      {
        automergePatch: 'some-value',
        patch: null,
      },
      {
        patch: {
          automerge: true,
        },
      },
    );
  });
});
