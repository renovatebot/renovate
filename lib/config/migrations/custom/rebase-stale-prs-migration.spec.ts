import { RebaseStalePrsMigration } from './rebase-stale-prs-migration';

describe('config/migrations/custom/rebase-stale-prs-migration', () => {
  it('should migrate true', () => {
    expect(RebaseStalePrsMigration).toMigrate(
      {
        rebaseStalePrs: true,
      },
      {
        rebaseWhen: 'behind-base-branch',
      },
    );
  });

  it('should migrate false', () => {
    expect(RebaseStalePrsMigration).toMigrate(
      {
        rebaseStalePrs: false,
      },
      {
        rebaseWhen: 'conflicted',
      },
    );
  });

  it('should migrate null', () => {
    expect(RebaseStalePrsMigration).toMigrate(
      {
        rebaseStalePrs: null,
      },
      {
        rebaseWhen: 'auto',
      },
    );
  });
});
