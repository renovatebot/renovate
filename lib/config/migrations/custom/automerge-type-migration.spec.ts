import { AutomergeTypeMigration } from './automerge-type-migration';

describe('config/migrations/custom/automerge-type-migration', () => {
  it('should migrate string like "branch-" to "branch"', async () => {
    await expect(AutomergeTypeMigration).toMigrate(
      {
        automergeType: 'branch-test',
      },
      {
        automergeType: 'branch',
      },
    );
  });

  it('should not migrate another string value', async () => {
    await expect(AutomergeTypeMigration).toMigrate(
      {
        automergeType: 'test',
      },
      {
        automergeType: 'test',
      },
      false,
    );
  });

  it('should not migrate non string value', async () => {
    await expect(AutomergeTypeMigration).toMigrate(
      {
        automergeType: true,
      },
      {
        automergeType: true,
      },
      false,
    );
  });
});
