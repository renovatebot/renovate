import { RebaseStalePrsMigration } from './rebase-stale-prs-migration';

describe('config/migrations/custom/rebase-stale-prs-migration', () => {
  it('should migrate true', async () => {
    await expect(RebaseStalePrsMigration).toMigrate(
      {
        rebaseStalePrs: true,
      },
      {
        rebaseWhen: 'behind-base-branch',
      },
    );
  });

  it('should migrate false', async () => {
    await expect(RebaseStalePrsMigration).toMigrate(
      {
        rebaseStalePrs: false,
      },
      {
        rebaseWhen: 'conflicted',
      },
    );
  });

  it('should migrate null', async () => {
    await expect(RebaseStalePrsMigration).toMigrate(
      {
        rebaseStalePrs: null,
      },
      {
        rebaseWhen: 'auto',
      },
    );
  });
});
