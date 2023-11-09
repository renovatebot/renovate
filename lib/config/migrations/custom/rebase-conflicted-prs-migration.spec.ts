import { RebaseConflictedPrs } from './rebase-conflicted-prs-migration';

describe('config/migrations/custom/rebase-conflicted-prs-migration', () => {
  it('should migrate false', () => {
    expect(RebaseConflictedPrs).toMigrate(
      {
        rebaseConflictedPrs: false,
      },
      {
        rebaseWhen: 'never',
      },
    );
  });
});
